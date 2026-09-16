"""RescueLens - Edge AI Aerial Detection System.

Production-ready FastAPI backend for aerial object detection using YOLO Tiny TFLite.
Strictly on-device inference using tf.lite.Interpreter with image slicing (tiling)
and global Non-Maximum Suppression for small-object drone detection.
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
TILE_SIZE = 416
OVERLAP = 0.20  # 20% overlap stride to ensure humans on tile boundaries are preserved
BASELINE_CONF_THRESHOLD = 0.45  # Hardcoded baseline confidence threshold (>= 45%) to filter out noise
RAW_CONF_THRESHOLD = BASELINE_CONF_THRESHOLD  # Baseline candidate cutoff prior to NMS
_env_conf = float(os.getenv("CONFIDENCE_THRESHOLD", "0.45"))
FINAL_CONF_THRESHOLD = max(BASELINE_CONF_THRESHOLD, _env_conf)  # Strict baseline confidence cutoff
GLOBAL_NMS_IOU_THRESHOLD = 0.40  # Global NMS IoU threshold to aggressively merge overlapping duplicates


class Detection(BaseModel):
    label: str = Field(
        default="human",
        description="Target classification label (strictly 'human')"
    )
    class_name: str = Field(
        default="human",
        alias="class",
        description="Object class name"
    )
    box: List[float] = Field(
        ...,
        description="Bounding box coordinates [xmin, ymin, xmax, ymax] in original image space",
        example=[34.5, 56.2, 140.8, 192.4]
    )
    bbox: List[float] = Field(
        ...,
        description="Alias bounding box coordinates [xmin, ymin, xmax, ymax]",
        example=[34.5, 56.2, 140.8, 192.4]
    )
    confidence: float = Field(
        ...,
        description="Confidence score exceeding 0.80 threshold",
        example=0.92
    )

    class Config:
        populate_by_name = True


class DetectionResponse(BaseModel):
    count: int = Field(..., description="Number of detected objects")
    detections: List[Detection] = Field(..., description="Array of detection objects")
    inference_time_ms: float = Field(..., description="Inference & processing time in milliseconds")
    is_demo: bool = Field(default=False, description="Production on-device inference indicator")
    execution_adapter: str = Field(default="TFLite On-Device Production", description="Execution adapter name")
    model_architecture: str = Field(default="YOLO-tiny (On-Device TFLite)", description="Model architecture")
    runtime: str = Field(default="TensorFlow Lite", description="Inference runtime")


def decode_image(image_bytes: bytes) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Decodes raw image bytes into a full-resolution OpenCV BGR image.
    """
    np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Failed to decode image. Ensure valid image bytes (JPEG, PNG, etc.).")

    orig_h, orig_w = image.shape[:2]
    metadata = {
        "orig_w": orig_w,
        "orig_h": orig_h,
    }
    return image, metadata


def generate_tiles(
    image: np.ndarray,
    tile_size: int = TILE_SIZE,
    overlap: float = OVERLAP
) -> List[Tuple[int, int, np.ndarray]]:
    """
    Slices the original high-resolution drone image into overlapping tiles of size
    tile_size x tile_size with a 20% overlap stride to preserve small targets.
    
    Returns:
        List of (x_offset, y_offset, tile_image) tuples.
    """
    orig_h, orig_w = image.shape[:2]
    stride = int(tile_size * (1.0 - overlap))
    if stride <= 0:
        stride = tile_size

    # Generate x-offsets with edge coverage
    x_offsets = list(range(0, max(1, orig_w - tile_size + 1), stride))
    if x_offsets[-1] + tile_size < orig_w:
        x_offsets.append(orig_w - tile_size)

    # Generate y-offsets with edge coverage
    y_offsets = list(range(0, max(1, orig_h - tile_size + 1), stride))
    if y_offsets[-1] + tile_size < orig_h:
        y_offsets.append(orig_h - tile_size)

    tiles: List[Tuple[int, int, np.ndarray]] = []
    for y_off in y_offsets:
        for x_off in x_offsets:
            crop = image[y_off:y_off + tile_size, x_off:x_off + tile_size]
            # If image is smaller than tile_size in any dimension, pad with neutral gray (114, 114, 114)
            if crop.shape[0] < tile_size or crop.shape[1] < tile_size:
                pad_bottom = max(0, tile_size - crop.shape[0])
                pad_right = max(0, tile_size - crop.shape[1])
                crop = cv2.copyMakeBorder(
                    crop, 0, pad_bottom, 0, pad_right, cv2.BORDER_CONSTANT, value=(114, 114, 114)
                )
            tiles.append((x_off, y_off, crop))

    return tiles


def apply_global_nms(
    boxes: List[List[float]],
    confidences: List[float],
    score_threshold: float = BASELINE_CONF_THRESHOLD,
    iou_threshold: float = GLOBAL_NMS_IOU_THRESHOLD,
    final_conf_threshold: Optional[float] = None,
) -> List[Detection]:
    """
    Applies strict global Non-Maximum Suppression (NMS) across all aggregated candidate
    boxes from all tiles to aggressively merge overlapping duplicate boxes on the same target.
    Enforces a strict baseline confidence threshold (>= 0.45) prior to NMS.
    """
    if not boxes or not confidences:
        return []

    effective_cutoff = max(
        BASELINE_CONF_THRESHOLD,
        final_conf_threshold if final_conf_threshold is not None else score_threshold
    )

    np_boxes = np.array(boxes, dtype=np.float32)
    np_scores = np.array(confidences, dtype=np.float32)

    # Filter out weak predictions (< 0.45) prior to the NMS pass
    valid_mask = np_scores >= effective_cutoff
    if not np.any(valid_mask):
        return []

    np_boxes = np_boxes[valid_mask]
    np_scores = np_scores[valid_mask]

    keep_indices: List[int] = []
    try:
        # Use exact float coordinates [x, y, w, h] without integer rounding to prevent IoU distortion
        cv_boxes = [
            [
                float(b[0]),
                float(b[1]),
                float(max(0.0, b[2] - b[0])),
                float(max(0.0, b[3] - b[1])),
            ]
            for b in np_boxes
        ]
        scores_list = [float(s) for s in np_scores]
        nms_result = cv2.dnn.NMSBoxes(
            bboxes=cv_boxes,
            scores=scores_list,
            score_threshold=effective_cutoff,
            nms_threshold=iou_threshold,
        )
        if len(nms_result) > 0:
            if isinstance(nms_result, np.ndarray):
                keep_indices = [int(x) for x in nms_result.flatten()]
            else:
                keep_indices = [
                    int(idx[0]) if isinstance(idx, (list, tuple, np.ndarray)) else int(idx)
                    for idx in nms_result
                ]
    except Exception as exc:
        logger.warning(f"cv2.dnn.NMSBoxes fallback triggered: {exc}")
        keep_indices = []

    # Pure numpy NMS fallback if OpenCV fails or returns empty unexpectedly
    if not keep_indices and len(np_boxes) > 0:
        x1 = np_boxes[:, 0]
        y1 = np_boxes[:, 1]
        x2 = np_boxes[:, 2]
        y2 = np_boxes[:, 3]
        areas = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
        order = np_scores.argsort()[::-1]

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

    # Build clean Detection objects strictly for post-NMS deduplicated list
    final_detections: List[Detection] = []
    for idx in keep_indices:
        conf = float(np_scores[idx])
        if conf >= effective_cutoff:
            b = [
                round(float(np_boxes[idx][0]), 2),
                round(float(np_boxes[idx][1]), 2),
                round(float(np_boxes[idx][2]), 2),
                round(float(np_boxes[idx][3]), 2),
            ]
            final_detections.append(
                Detection(
                    label="human",
                    class_name="human",
                    confidence=round(conf, 4),
                    box=b,
                    bbox=b,
                )
            )

    # Sort final detections in descending confidence order
    final_detections.sort(key=lambda d: d.confidence, reverse=True)
    return final_detections


class TFLiteYOLOEngine:
    """
    Production-ready local YOLO Tiny inference engine using tensorflow.lite.Interpreter.
    Supports on-device image slicing (tiling) with 20% overlap stride to preserve
    small-object spatial resolution in drone imagery.
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
            os.path.abspath(path),
            os.path.join(os.getcwd(), path),
            os.path.join(os.path.dirname(__file__), "..", "..", path),
            os.path.join(os.path.dirname(__file__), path),
            os.path.join(os.path.dirname(__file__), "..", "..", "yolo_tiny_rescue.tflite"),
            os.path.join(os.getcwd(), "backend", "yolo_tiny_rescue.tflite"),
            "/app/yolo_tiny_rescue.tflite",
            "/app/backend/yolo_tiny_rescue.tflite",
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

    def infer(
        self,
        image: np.ndarray,
        metadata: Dict[str, Any],
        conf_threshold: Optional[float] = None
    ) -> List[Detection]:
        """
        Executes on-device tiled inference across the high-resolution image:
        1. Slices image into overlapping 416x416 tiles (20% stride).
        2. Runs TFLite interpreter across tiles.
        3. Filters out weak predictions (< 0.45) prior to coordinate mapping and NMS.
        4. Translates local tile bounding box coordinates to absolute global coordinates before deduplication.
        5. Collects all mapped bounding boxes from all tiles into a single array and applies strict global NMS (IoU 0.40).
        6. Returns clean deduplicated list of detections.
        """
        if self.interpreter is None or self.input_details is None or self.output_details is None:
            raise RuntimeError("TFLite interpreter is not initialized.")

        orig_w = metadata["orig_w"]
        orig_h = metadata["orig_h"]

        # Hardcode a stricter baseline confidence threshold of at least 0.45 (45%)
        # Discard weak predictions prior to the NMS pass
        if conf_threshold is not None:
            active_conf_thresh = max(BASELINE_CONF_THRESHOLD, float(conf_threshold))
        else:
            active_conf_thresh = max(BASELINE_CONF_THRESHOLD, FINAL_CONF_THRESHOLD)

        # 1. Generate overlapping tiles
        tiles = generate_tiles(image, tile_size=TILE_SIZE, overlap=OVERLAP)

        aggregated_boxes: List[List[float]] = []
        aggregated_confidences: List[float] = []

        input_index = self.input_details[0]["index"]
        output_index = self.output_details[0]["index"]
        target_dtype = self.input_details[0]["dtype"]

        # 2. Sequential on-device inference across generated tiles
        for x_off, y_off, tile_bgr in tiles:
            tile_rgb = cv2.cvtColor(tile_bgr, cv2.COLOR_BGR2RGB)
            if target_dtype == np.uint8:
                tile_tensor = np.expand_dims(tile_rgb, axis=0)
            elif target_dtype == np.int8:
                tile_tensor = np.expand_dims(tile_rgb.astype(np.int8) - 128, axis=0)
            else:
                tile_norm = tile_rgb.astype(np.float32) / 255.0
                tile_tensor = np.expand_dims(tile_norm.astype(target_dtype), axis=0)

            self.interpreter.set_tensor(input_index, tile_tensor)
            self.interpreter.invoke()
            raw_output = self.interpreter.get_tensor(output_index)

            # Squeeze output to shape (N, 5) or (N, 6)
            data = np.squeeze(raw_output)
            if data.ndim == 1 and len(data) in (5, 6):
                data = np.expand_dims(data, axis=0)
            elif data.ndim == 2 and data.shape[0] < data.shape[1] and data.shape[0] in (5, 6):
                data = data.T

            if data.ndim != 2 or data.shape[1] < 5:
                continue

            cx = data[:, 0]
            cy = data[:, 1]
            w = data[:, 2]
            h = data[:, 3]

            if data.shape[1] == 5:
                confidences = data[:, 4]
            else:
                confidences = data[:, 4] * np.max(data[:, 5:], axis=1)

            # Handle normalized vs absolute tile coords
            if len(cx) > 0 and np.max(cx) <= 1.0 and np.max(cy) <= 1.0:
                cx = cx * TILE_SIZE
                cy = cy * TILE_SIZE
                w = w * TILE_SIZE
                h = h * TILE_SIZE

            # 3. Filter weak predictions prior to NMS (strict baseline >= 0.45)
            valid_mask = confidences >= active_conf_thresh
            if not np.any(valid_mask):
                continue

            cx = cx[valid_mask]
            cy = cy[valid_mask]
            w = w[valid_mask]
            h = h[valid_mask]
            conf = confidences[valid_mask]

            # 4. Absolute Coordinate Mapping: translate local tile coords to global image coordinates
            # This translation happens before deduplication
            lx1 = cx - (w / 2.0)
            ly1 = cy - (h / 2.0)
            lx2 = cx + (w / 2.0)
            ly2 = cy + (h / 2.0)

            gx1 = np.clip(x_off + lx1, 0, orig_w)
            gy1 = np.clip(y_off + ly1, 0, orig_h)
            gx2 = np.clip(x_off + lx2, 0, orig_w)
            gy2 = np.clip(y_off + ly2, 0, orig_h)

            for i in range(len(conf)):
                # Ensure box has positive dimensions and center is within original image frame
                if gx2[i] > gx1[i] and gy2[i] > gy1[i]:
                    if (x_off + cx[i]) < orig_w and (y_off + cy[i]) < orig_h:
                        aggregated_boxes.append([float(gx1[i]), float(gy1[i]), float(gx2[i]), float(gy2[i])])
                        aggregated_confidences.append(float(conf[i]))

        # 5. Strict Global NMS applied across all aggregated mapped boxes from all tiles
        return apply_global_nms(
            boxes=aggregated_boxes,
            confidences=aggregated_confidences,
            score_threshold=active_conf_thresh,
            iou_threshold=GLOBAL_NMS_IOU_THRESHOLD,
            final_conf_threshold=active_conf_thresh,
        )


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

# Configurable CORS origins via environment variables for strict production deployments
_cors_env = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS")
if _cors_env:
    if _cors_env.strip() == "*":
        CORS_ORIGINS = ["*"]
        ALLOW_ORIGIN_REGEX = None
    else:
        CORS_ORIGINS = [orig.strip() for orig in _cors_env.split(",") if orig.strip()]
        ALLOW_ORIGIN_REGEX = None
else:
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:8000",
    ]
    is_prod = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod")
    ALLOW_ORIGIN_REGEX = None if is_prod else r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
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
        "is_demo": False,
        "execution_adapter": "TFLite On-Device Production",
        "model_path": MODEL_PATH,
        "confidence_threshold": FINAL_CONF_THRESHOLD,
    }


@app.post(
    "/api/detect",
    response_model=DetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect objects in a single aerial image using high-resolution tiling",
    tags=["Detection"]
)
async def detect(
    file: UploadFile = File(...),
    confidence_threshold: Optional[float] = None
):
    """
    Accepts one high-resolution drone image, splits it into overlapping 416x416 tiles (20% stride),
    executes on-device YOLO-tiny inference per tile, applies global NMS, and returns high-confidence human detections.
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
        image, metadata = decode_image(image_bytes)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as exc:
        logger.error(f"Image decoding error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred during image decoding."
        )

    try:
        detections = engine.infer(image, metadata, conf_threshold=confidence_threshold)
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
        inference_time_ms=round(elapsed_ms, 2),
        is_demo=False,
        execution_adapter="TFLite On-Device Production",
        model_architecture="YOLO-tiny (On-Device TFLite)",
        runtime="TensorFlow Lite"
    )


@app.post(
    "/api/batch-process",
    response_model=DetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Batch detect objects in up to 100 aerial images with image slicing",
    tags=["Detection"]
)
async def batch_process(
    files: List[UploadFile] = File(...),
    confidence_threshold: Optional[float] = None
):
    """
    Accepts up to 100 drone images, processes each through the on-device tiled YOLO pipeline,
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
            image, metadata = decode_image(image_bytes)
            dets = engine.infer(image, metadata, conf_threshold=confidence_threshold)
            aggregated_detections.extend(dets)
        except Exception as exc:
            logger.warning(f"Error processing batch image {file.filename} (index {idx}): {exc}")
            continue

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    return DetectionResponse(
        count=len(aggregated_detections),
        detections=aggregated_detections,
        inference_time_ms=round(elapsed_ms, 2),
        is_demo=False,
        execution_adapter="TFLite On-Device Production",
        model_architecture="YOLO-tiny (On-Device TFLite)",
        runtime="TensorFlow Lite"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
