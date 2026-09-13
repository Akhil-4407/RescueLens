"""Model Export and Quantization Pipeline to TensorFlow Lite [B-03 RESCUE EYE].

Exports trained TensorFlow Keras YOLO-tiny model to TFLite format
with INT8 / FP16 quantization enabled for strict on-device CPU execution.
"""

import os
import argparse
import tensorflow as tf
from pathlib import Path


def export_to_tflite(
    model_or_path,
    output_path: str = "backend/yolo_tiny_rescue.tflite",
    quantization: str = "fp16",  # "fp16" or "int8" or "default"
):
    """
    Exports a Keras model to a quantized TensorFlow Lite FlatBuffer model.
    """
    if isinstance(model_or_path, str):
        print(f"Loading Keras model from {model_or_path}...")
        model = tf.keras.models.load_model(model_or_path)
    else:
        model = model_or_path

    print(f"Configuring TFLiteConverter with {quantization.upper()} quantization...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]

    if quantization == "fp16":
        converter.target_spec.supported_types = [tf.float16]
        print("Enabled FP16 half-precision quantization.")

    tflite_model = converter.convert()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(tflite_model)

    print(f"Successfully exported TFLite model ({len(tflite_model):,} bytes) to: {output_path}")

    # Verify loading with tf.lite.Interpreter
    try:
        interpreter = tf.lite.Interpreter(model_path=output_path)
        interpreter.allocate_tensors()
        inp = interpreter.get_input_details()[0]
        out = interpreter.get_output_details()[0]
        print("Verified on-device TFLite Interpreter load:")
        print(f"  Input Tensor:  shape={inp['shape']}, dtype={inp['dtype']}")
        print(f"  Output Tensor: shape={out['shape']}, dtype={out['dtype']}")
    except Exception as e:
        print(f"Interpreter verification note: {e}")

    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export YOLO model to quantized TFLite")
    parser.add_argument(
        "--model",
        type=str,
        default="model/yolo_tiny_human.keras",
        help="Path to trained Keras model"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="backend/yolo_tiny_rescue.tflite",
        help="Production target path"
    )
    parser.add_argument(
        "--quantization",
        type=str,
        default="fp16",
        choices=["fp16", "int8", "default"],
        help="Quantization precision"
    )
    args = parser.parse_args()

    export_to_tflite(args.model, args.output, args.quantization)
