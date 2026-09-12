"""RescueLens - Edge AI Aerial Detection System.

Production-ready FastAPI backend for aerial object detection using YOLO Tiny TFLite.
Strictly on-device inference using tf.lite.Interpreter with no external cloud dependencies.
"""

import os
import sys
import time
import logging
from typing import List, Tuple, Dict, Any, Optional
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("RescueLensBackend")

# TFLite Interpreter Import with fallback
try:
    import tensorflow as tf
    Interpreter = tf.lite.Interpreter
except (ImportError, AttributeError):
    try:
        from tflite_runtime.interpreter import Interpreter
    except ImportError:
        try:
            from tensorflow.lite.python.interpreter import Interpreter
        except ImportError:
            Interpreter = None

# Model Configuration
MODEL_PATH = os.getenv("MODEL_PATH", "yolo_tiny_rescue.tflite")
TARGET_RESOLUTION = (416, 416)
CONFIDENCE_THRESHOLD = 0.80  # Strict project accuracy constraint (>80%)
IOU_THRESHOLD = 0.45


class Detection(BaseModel):
    box: List[float] = Field(
        ...,
        description="Bounding box coordinates [x1, y1, x2, y2] in original image space",
        example=[34.5, 56.2, 140.8, 192.4]
    )
    confidence: float = Field(
        ...,
        description="Confidence score exceeding 0.80 threshold",
        example=0.92
    )


class DetectionResponse(BaseModel):
    count: int = Field(..., description="Number of detected objects")
    detections: List[Detection] = Field(..., description="Array of detection objects")
    inference_time_ms: float = Field(..., description="Inference & processing time in milliseconds")


def preprocess_image(
    image_bytes: bytes,
    target_size: Tuple[int, int] = TARGET_RESOLUTION
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Decodes image bytes, letterboxes to target_size (416x416) preserving aspect ratio,
    and normalizes pixel values to [0.0, 1.0].

    Returns:
        input_tensor: np.ndarray with shape (1, target_h, target_w, 3), float32.
        metadata: Dict containing original dimensions, scale, and padding offsets.
    """
    np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Failed to decode image. Ensure valid image bytes (JPEG, PNG, etc.).")

    orig_h, orig_w = image.shape[:2]
    target_w, target_h = target_size

    # Compute aspect-ratio preserving scale
    scale = min(target_w / orig_w, target_h / orig_h)
    new_w = int(round(orig_w * scale))
    new_h = int(round(orig_h * scale))

    # Resize image
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    # Compute padding (symmetric letterbox)
    pad_w = (target_w - new_w) / 2.0
    pad_h = (target_h - new_h) / 2.0
    top = int(round(pad_h - 0.1))
    bottom = int(round(pad_h + 0.1))
    left = int(round(pad_w - 0.1))
    right = int(round(pad_w + 0.1))

    # Standard constant border padding with neutral gray (114, 114, 114)
    letterboxed = cv2.copyMakeBorder(
        resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114)
    )

    # Convert BGR (OpenCV default) to RGB
    letterboxed_rgb = cv2.cvtColor(letterboxed, cv2.COLOR_BGR2RGB)

    # Normalize pixel values to [0.0, 1.0]
    normalized = letterboxed_rgb.astype(np.float32) / 255.0

    # Expand batch dimension: (1, 416, 416, 3)
    input_tensor = np.expand_dims(normalized, axis=0)

    metadata = {
        "orig_w": orig_w,
        "orig_h": orig_h,
        "scale": scale,
        "pad_w": pad_w,
        "pad_h": pad_h,
        "top": top,
        "left": left,
        "target_w": target_w,
        "target_h": target_h,
    }
    return input_tensor, metadata


def non_maximum_suppression(
    boxes: np.ndarray,
    confidences: np.ndarray,
    conf_threshold: float = CONFIDENCE_THRESHOLD,
    iou_threshold: float = IOU_THRESHOLD,
) -> List[Detection]:
    """
    Applies strict confidence filter (>0.80) and Non-Maximum Suppression (NMS)
    to eliminate duplicate overlapping bounding boxes.

    Args:
        boxes: Array of shape (N, 4) in [x1, y1, x2, y2] format.
        confidences: Array of shape (N,) containing object detection confidence scores.
        conf_threshold: Strict filter (>0.80).
        iou_threshold: IoU overlap threshold for suppression.

    Returns:
        List of Detection objects.
    """
    if len(boxes) == 0 or len(confidences) == 0:
        return []

    # Strict confidence filtering > 0.80
    valid_mask = confidences > conf_threshold
    filtered_boxes = boxes[valid_mask]
    filtered_confidences = confidences[valid_mask]

    if len(filtered_boxes) == 0:
        return []

    x1 = filtered_boxes[:, 0]
    y1 = filtered_boxes[:, 1]
    x2 = filtered_boxes[:, 2]
    y2 = filtered_boxes[:, 3]
    w = np.maximum(0.0, x2 - x1)
    h = np.maximum(0.0, y2 - y1)

    cv_boxes = [[int(x1[i]), int(y1[i]), int(w[i]), int(h[i])] for i in range(len(filtered_boxes))]
    scores = filtered_confidences.tolist()

    keep_indices: List[int] = []
    try:
        nms_result = cv2.dnn.NMSBoxes(
            bboxes=cv_boxes,
            scores=scores,
            score_threshold=conf_threshold,
            nms_threshold=iou_threshold,
        )
        if len(nms_result) > 0:
            if isinstance(nms_result, np.ndarray):
                keep_indices = nms_result.flatten().tolist()
            else:
                keep_indices = [idx[0] if isinstance(idx, (list, tuple, np.ndarray)) else idx for idx in nms_result]
    except Exception as e:
        logger.warning(f"cv2.dnn.NMSBoxes fallback triggered: {e}")
        # Pure numpy NMS fallback
        areas = w * h
        order = filtered_confidences.argsort()[::-1]
        while order.size > 0:
            i = order[0]
            keep_indices.append(int(i))
            if order.size == 1:
                break
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])
            inter_w = np.maximum(0.0, xx2 - xx1)
            inter_h = np.maximum(0.0, yy2 - yy1)
            inter = inter_w * inter_h
            union = areas[i] + areas[order[1:]] - inter
            iou = inter / np.maximum(union, 1e-6)
            inds = np.where(iou <= iou_threshold)[0]
            order = order[inds + 1]

    detections: List[Detection] = []
    for idx in keep_indices:
        detections.append(
            Detection(
                box=[
                    round(float(filtered_boxes[idx][0]), 2),
                    round(float(filtered_boxes[idx][1]), 2),
                    round(float(filtered_boxes[idx][2]), 2),
                    round(float(filtered_boxes[idx][3]), 2),
                ],
                confidence=round(float(filtered_confidences[idx]), 4),
            )
        )
    return detections


class TFLiteYOLOEngine:
    """
    Production-ready local YOLO Tiny inference engine using tensorflow.lite.Interpreter.
    Allocates tensors once at application startup to eliminate per-request latency.
    Runs strictly on-device without cloud or external endpoints.
    """

    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.interpreter: Optional[Any] = None
        self.input_details: Optional[List[Dict[str, Any]]] = None
        self.output_details: Optional[List[Dict[str, Any]]] = None
        self._load_and_allocate()

    def _resolve_model_path(self, path: str) -> str:
        if os.path.isabs(path) and os.path.exists(path):
            return path
        candidates = [
            path,
            os.path.join(os.getcwd(), path),
            os.path.join(os.path.dirname(__file__), "..", "..", path),
            os.path.join(os.path.dirname(__file__), path),
            os.path.join(os.path.dirname(__file__), "..", "..", "yolo_tiny_rescue.tflite"),
            os.path.join(os.getcwd(), "backend", "yolo_tiny_rescue.tflite"),
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                return os.path.abspath(candidate)
        return os.path.abspath(path)

    def _load_and_allocate(self):
        resolved_path = self._resolve_model_path(self.model_path)
        logger.info(f"Loading production TFLite YOLO model from: {resolved_path}")

        if not os.path.exists(resolved_path):
            raise FileNotFoundError(
                f"TFLite YOLO-tiny model file not found at: '{resolved_path}'"
            )

        if Interpreter is None:
            raise RuntimeError(
                "Neither tensorflow.lite nor tflite_runtime Interpreter is available."
            )

        try:
            self.interpreter = Interpreter(model_path=resolved_path)
            self.interpreter.allocate_tensors()
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            logger.info("Successfully loaded TFLite YOLO model and allocated tensors.")
            logger.info(f"Input details: {self.input_details}")
            logger.info(f"Output details: {self.output_details}")
        except Exception as exc:
            logger.error(f"Failed to initialize TFLite interpreter with '{resolved_path}': {exc}")
            raise RuntimeError(f"TFLite interpreter initialization failed: {exc}") from exc

    def infer(self, input_tensor: np.ndarray, metadata: Dict[str, Any]) -> List[Detection]:
        """
        Runs on-device model inference on the pre-processed input tensor and returns filtered detections.
        """
        if self.interpreter is None or self.input_details is None or self.output_details is None:
            raise RuntimeError("TFLite interpreter is not initialized.")

        # Handle tensor shape mismatch (NHWC vs NCHW)
        target_shape = self.input_details[0]["shape"]
        dtype = self.input_details[0]["dtype"]

        tensor_to_feed = input_tensor
        if len(target_shape) == 4:
            if target_shape[1] == 3 and input_tensor.shape[-1] == 3:
                tensor_to_feed = np.transpose(input_tensor, (0, 3, 1, 2))
            elif target_shape[-1] == 3 and input_tensor.shape[1] == 3:
                tensor_to_feed = np.transpose(input_tensor, (0, 2, 3, 1))

        # Handle quantization if model expects uint8 or int8
        if dtype == np.uint8:
            tensor_to_feed = (tensor_to_feed * 255.0).astype(np.uint8)
        elif dtype == np.int8:
            tensor_to_feed = (tensor_to_feed * 255.0 - 128.0).astype(np.int8)
        else:
            tensor_to_feed = tensor_to_feed.astype(dtype)

        # Set tensor, invoke on-device interpreter, and retrieve output
        self.interpreter.set_tensor(self.input_details[0]["index"], tensor_to_feed)
        self.interpreter.invoke()
        output_data = self.interpreter.get_tensor(self.output_details[0]["index"])

        # Parse output tensor into boxes and confidences
        boxes, confidences = self._parse_yolo_output(output_data, metadata)
        return non_maximum_suppression(boxes, confidences)

    def _parse_yolo_output(
        self,
        output_data: np.ndarray,
        metadata: Dict[str, Any]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Parses raw YOLO Tiny output into coordinates in original image space.
        Expected formats: (1, N, 6) or (1, 6, N) or (N, 6) or (1, N, 5) or (1, 5, N)
        where columns/rows represent [cx, cy, w, h, obj_conf, class_conf].
        """
        data = np.squeeze(output_data)
        if data.ndim == 1 and len(data) in (5, 6):
            data = np.expand_dims(data, axis=0)

        if data.ndim == 2 and data.shape[0] < data.shape[1] and data.shape[0] in (5, 6):
            data = data.T

        if data.ndim != 2 or data.shape[1] < 5:
            return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)

        scale = metadata["scale"]
        pad_w = metadata["pad_w"]
        pad_h = metadata["pad_h"]
        orig_w = metadata["orig_w"]
        orig_h = metadata["orig_h"]
        target_w = metadata.get("target_w", 416)
        target_h = metadata.get("target_h", 416)

        cx = data[:, 0]
        cy = data[:, 1]
        w = data[:, 2]
        h = data[:, 3]

        if data.shape[1] == 5:
            confidences = data[:, 4]
        else:
            confidences = data[:, 4] * np.max(data[:, 5:], axis=1)

        # Handle both normalized [0..1] coordinates and pixel [0..416] coordinates
        if len(cx) > 0 and np.max(cx) <= 1.0 and np.max(cy) <= 1.0 and np.max(w) <= 1.0 and np.max(h) <= 1.0:
            cx_px = cx * target_w
            cy_px = cy * target_h
            w_px = w * target_w
            h_px = h * target_h
        else:
            cx_px = cx
            cy_px = cy
            w_px = w
            h_px = h

        # Convert [cx, cy, w, h] to [x1, y1, x2, y2] in letterbox space
        x1 = cx_px - (w_px / 2.0)
        y1 = cy_px - (h_px / 2.0)
        x2 = cx_px + (w_px / 2.0)
        y2 = cy_px + (h_px / 2.0)

        # Rescale back to original image space by removing letterbox padding
        orig_x1 = np.clip((x1 - pad_w) / scale, 0, orig_w)
        orig_y1 = np.clip((y1 - pad_h) / scale, 0, orig_h)
        orig_x2 = np.clip((x2 - pad_w) / scale, 0, orig_w)
        orig_y2 = np.clip((y2 - pad_h) / scale, 0, orig_h)

        boxes = np.stack([orig_x1, orig_y1, orig_x2, orig_y2], axis=1)
        return boxes.astype(np.float32), confidences.astype(np.float32)


# Global Engine reference
engine: Optional[TFLiteYOLOEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager that loads the model and allocates tensors ONCE
    at application startup, preventing reloading latency on subsequent requests.
    """
    global engine
    logger.info("Initializing RescueLens on-device TFLite YOLO-tiny inference engine...")
    engine = TFLiteYOLOEngine(model_path=MODEL_PATH)
    logger.info("RescueLens inference engine successfully initialized and ready.")
    yield
    logger.info("Shutting down RescueLens backend.")


# Initialize FastAPI application
app = FastAPI(
    title="RescueLens - Edge AI Aerial Detection System",
    description="Edge AI aerial detection backend running on-device YOLO Tiny inference via TFLite.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS middleware for all local development origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Monitoring"])
async def health_check():
    """Health check endpoint to verify backend status and model allocation."""
    return {
        "status": "online",
        "engine_ready": engine is not None and engine.interpreter is not None,
        "model_path": MODEL_PATH,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
    }


@app.post(
    "/api/detect",
    response_model=DetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect objects in a single aerial image",
    tags=["Detection"]
)
async def detect(file: UploadFile = File(...)):
    """
    Accepts one image, letterboxes to 416x416, runs YOLO inference on-device,
    applies strict confidence filtering (>0.80) & NMS, and returns detection results.
    """
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inference engine is not initialized."
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded image file is empty."
        )

    start_time = time.perf_counter()
    try:
        input_tensor, metadata = preprocess_image(image_bytes)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as exc:
        logger.error(f"Preprocessing error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred during image pre-processing."
        )

    try:
        detections = engine.infer(input_tensor, metadata)
    except Exception as exc:
        logger.error(f"Inference error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference failure: {str(exc)}"
        )

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    return DetectionResponse(
        count=len(detections),
        detections=detections,
        inference_time_ms=round(elapsed_ms, 2)
    )


@app.post(
    "/api/batch-process",
    response_model=DetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Batch detect objects in up to 100 aerial images",
    tags=["Detection"]
)
async def batch_process(files: List[UploadFile] = File(...)):
    """
    Accepts up to 100 images, processes each through the YOLO pipeline locally,
    and returns aggregated detections, total count, and total inference time.
    """
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inference engine is not initialized."
        )

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided in batch upload."
        )

    if len(files) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch size exceeds maximum limit of 100 images (received {len(files)})."
        )

    start_time = time.perf_counter()
    aggregated_detections: List[Detection] = []

    for idx, file in enumerate(files):
        image_bytes = await file.read()
        if not image_bytes:
            logger.warning(f"Skipping empty file at batch index {idx}: {file.filename}")
            continue

        try:
            input_tensor, metadata = preprocess_image(image_bytes)
            dets = engine.infer(input_tensor, metadata)
            aggregated_detections.extend(dets)
        except Exception as exc:
            logger.warning(f"Error processing batch image {file.filename} (index {idx}): {exc}")
            continue

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    return DetectionResponse(
        count=len(aggregated_detections),
        detections=aggregated_detections,
        inference_time_ms=round(elapsed_ms, 2)
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
