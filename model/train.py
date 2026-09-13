"""Training Pipeline for Drone-Specific Human Detection [B-03 RESCUE EYE].

Fine-tunes a lightweight YOLO architecture (e.g. YOLOv8n / YOLO-tiny)
on the converted VisDrone human dataset targeting >80% accuracy for aerial rescue missions.
"""

import os
import sys
import argparse
from pathlib import Path


def train_yolo(
    data_yaml: str,
    model_name: str = "yolov8n.pt",
    epochs: int = 50,
    img_size: int = 416,
    batch_size: int = 16,
    device: str = "cpu",
    output_dir: str = "runs/train",
):
    """
    Fine-tunes a lightweight YOLO model on aerial human imagery.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[ERROR] ultralytics package is required for training: pip install ultralytics")
        return

    print(f"Loading base lightweight architecture: {model_name}")
    model = YOLO(model_name)

    print(f"Starting training on {data_yaml} with image resolution {img_size}x{img_size}...")
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=img_size,
        batch=batch_size,
        device=device,
        project=output_dir,
        name="visdrone_human_model",
        exist_ok=True,
        # Aerial small-object hyperparameters
        mosaic=1.0,
        mixup=0.1,
        fl_gamma=1.5,  # Focus on hard small-object examples
        plots=True,
        save=True,
    )

    print("Training complete! Best weights saved at:", Path(output_dir) / "visdrone_human_model" / "weights" / "best.pt")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train lightweight YOLO on VisDrone Human dataset")
    parser.add_argument(
        "--data",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "visdrone_human.yaml"),
        help="Path to dataset yaml"
    )
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model weights")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=416, help="Input resolution")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--device", type=str, default="cpu", help="Compute device ('cpu' or 'mps')")
    args = parser.parse_args()

    train_yolo(args.data, args.model, args.epochs, args.imgsz, args.batch, args.device)
