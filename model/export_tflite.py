"""Model Export and Quantization Pipeline to TensorFlow Lite [B-03 RESCUE EYE].

Exports trained PyTorch/YOLO models to TensorFlow Lite format with FP16/INT8 quantization
for strict on-device CPU execution.
"""

import os
import argparse
from pathlib import Path


def export_to_tflite(
    weights_path: str,
    img_size: int = 416,
    half: bool = False,
    int8: bool = False,
    output_path: str = "backend/yolo_tiny_rescue.tflite"
):
    """
    Exports YOLO weights to TFLite format.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[ERROR] ultralytics package is required for export: pip install ultralytics")
        return

    print(f"Loading weights from {weights_path}...")
    model = YOLO(weights_path)

    print(f"Exporting to TFLite (imgsz={img_size}, int8={int8}, half={half})...")
    exported_file = model.export(
        format="tflite",
        imgsz=img_size,
        int8=int8,
        half=half,
    )
    print("TFLite export generated at:", exported_file)

    # Copy to production destination if specified
    if output_path and os.path.exists(exported_file):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        import shutil
        shutil.copy2(exported_file, output_path)
        print(f"Copied finalized TFLite model to production destination: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export YOLO model to quantized TFLite")
    parser.add_argument("--weights", type=str, required=True, help="Path to best.pt weights")
    parser.add_argument("--imgsz", type=int, default=416, help="Input image dimension")
    parser.add_argument("--int8", action="store_true", help="Enable INT8 quantization")
    parser.add_argument("--half", action="store_true", help="Enable FP16 half-precision")
    parser.add_argument(
        "--output",
        type=str,
        default="backend/yolo_tiny_rescue.tflite",
        help="Production target path"
    )
    args = parser.parse_args()

    export_to_tflite(args.weights, args.imgsz, args.half, args.int8, args.output)
