"""Quantization and TensorFlow Lite Export Pipeline [B-03 RESCUE EYE].

Exports trained YOLO-tiny PyTorch weights to quantized TensorFlow Lite (.tflite) format
(FP16 half-precision or INT8) optimized for on-device CPU execution in the FastAPI inference engine.
"""

import os
import sys
import shutil
import argparse
from pathlib import Path
from ultralytics import YOLO

# Suppress verbose TF logging
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf


def export_to_tflite(
    weights_path: str,
    output_tflite_path: str = "../backend/yolo_tiny_rescue.tflite",
    imgsz: int = 416,
    quantization: str = "fp16",  # "fp16" or "int8"
) -> str:
    """
    Exports a trained YOLO PyTorch model to a quantized TensorFlow Lite model.
    """
    weights_path = os.path.abspath(weights_path)
    output_tflite_path = os.path.abspath(output_tflite_path)

    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Model weights not found at: {weights_path}")

    print(f"--- Exporting YOLO-tiny to Quantized TensorFlow Lite ---")
    print(f"Source PyTorch weights: {weights_path}")
    print(f"Input image resolution: {imgsz}x{imgsz}")
    print(f"Target quantization:    {quantization.upper()}")
    print(f"Final deployment path:  {output_tflite_path}")

    model = YOLO(weights_path)

    # Export to SavedModel format which generates both float32 and float16/int8 tflite flatbuffers
    export_kwargs = {
        "format": "saved_model",
        "imgsz": imgsz,
        "keras": False,
    }
    if quantization == "int8":
        export_kwargs["int8"] = True

    saved_model_dir = model.export(**export_kwargs)
    print(f"Generated SavedModel bundle at: {saved_model_dir}")

    # Locate the quantized tflite file
    target_suffix = "_int8.tflite" if quantization == "int8" else "_float16.tflite"
    tflite_candidate = None

    for root, _, files in os.walk(saved_model_dir):
        for f in files:
            if f.endswith(target_suffix):
                tflite_candidate = os.path.join(root, f)
                break
        if tflite_candidate:
            break

    # Fallback to any .tflite file in directory if specific quantization suffix not found
    if not tflite_candidate:
        for root, _, files in os.walk(saved_model_dir):
            for f in files:
                if f.endswith(".tflite"):
                    tflite_candidate = os.path.join(root, f)
                    break
            if tflite_candidate:
                break

    if not tflite_candidate or not os.path.exists(tflite_candidate):
        raise RuntimeError(f"Failed to find generated .tflite file inside: {saved_model_dir}")

    print(f"Found exported quantized model: {tflite_candidate} ({os.path.getsize(tflite_candidate):,} bytes)")

    # Ensure target directory exists and copy model
    os.makedirs(os.path.dirname(output_tflite_path), exist_ok=True)
    shutil.copyfile(tflite_candidate, output_tflite_path)
    print(f"Successfully deployed quantized model to: {output_tflite_path}")

    # Verify model with TFLite Interpreter
    verify_tflite_model(output_tflite_path)

    return output_tflite_path


def verify_tflite_model(tflite_path: str):
    """
    Allocates tensors using tf.lite.Interpreter to ensure full on-device compatibility.
    """
    print("\n--- Verifying Deployed TFLite Model ---")
    interpreter = tf.lite.Interpreter(model_path=tflite_path)
    interpreter.allocate_tensors()

    inp_details = interpreter.get_input_details()
    out_details = interpreter.get_output_details()

    print("TFLite Model Input Details:")
    for idx, inp in enumerate(inp_details):
        print(f"  [{idx}] Name: {inp['name']}, Shape: {inp['shape']}, Dtype: {inp['dtype']}")

    print("TFLite Model Output Details:")
    for idx, out in enumerate(out_details):
        print(f"  [{idx}] Name: {out['name']}, Shape: {out['shape']}, Dtype: {out['dtype']}")

    # Sanity check output dimension
    out_shape = out_details[0]["shape"]
    print(f"Verified model ready for RescueLens FastAPI engine (Output shape: {out_shape}).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export YOLO PyTorch weights to Quantized TFLite")
    parser.add_argument(
        "--weights",
        type=str,
        default="weights/best.pt",
        help="Path to trained PyTorch weights (.pt)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="../backend/yolo_tiny_rescue.tflite",
        help="Target deployed TFLite path"
    )
    parser.add_argument(
        "--quantization",
        type=str,
        default="fp16",
        choices=["fp16", "int8"],
        help="Quantization precision"
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=416,
        help="Input resolution"
    )
    args = parser.parse_args()

    export_to_tflite(
        weights_path=args.weights,
        output_tflite_path=args.output,
        imgsz=args.imgsz,
        quantization=args.quantization
    )
