"""VisDrone to YOLO Format Preprocessing Pipeline [B-03 RESCUE EYE].

Parses VisDrone2019 detection annotations and filters exclusively for human target classes:
  Category 1: pedestrian
  Category 2: people
Both mapped to target class 0: human.

Converts bounding boxes into normalized YOLO format:
  <class_id> <x_center> <y_center> <width> <height>

Generates:
  - Label files in VisDrone2019-DET-train/labels/
  - Train / Val split text files (train.txt, val.txt)
  - Dataset configuration YAML: model/visdrone_human.yaml
"""

import os
import glob
import struct
import random
from pathlib import Path
from typing import Tuple, List, Optional
import cv2


HUMAN_CATEGORIES = {1, 2}  # 1: pedestrian, 2: people -> class 0


def get_image_dimensions(image_path: str) -> Tuple[int, int]:
    """
    Fast binary JPEG/PNG header parser for image dimensions (width, height),
    falling back to OpenCV if header decoding fails.
    """
    try:
        with open(image_path, "rb") as f:
            data = f.read(2)
            if data == b"\xff\xd8":  # JPEG
                while True:
                    read_bytes = f.read(4)
                    if len(read_bytes) < 4:
                        break
                    marker, length = struct.unpack(">2sH", read_bytes)
                    if marker[0] != 0xFF:
                        break
                    if marker[1] in [0xC0, 0xC1, 0xC2, 0xC3]:
                        sof_data = f.read(5)
                        if len(sof_data) >= 5:
                            _, height, width = struct.unpack(">BHH", sof_data)
                            return width, height
                    else:
                        f.seek(length - 2, 1)
            elif data == b"\x89P":  # PNG
                f.seek(16)
                width, height = struct.unpack(">II", f.read(8))
                return width, height
    except Exception:
        pass

    # OpenCV fallback
    img = cv2.imread(image_path)
    if img is not None:
        return img.shape[1], img.shape[0]
    return 1920, 1080


def convert_visdrone_bbox(
    img_width: int,
    img_height: int,
    bbox: Tuple[float, float, float, float]
) -> Tuple[float, float, float, float]:
    """
    Converts VisDrone absolute [left, top, width, height] into normalized YOLO [x_center, y_center, w, h].
    Clips all coordinates strictly into [0.0, 1.0].
    """
    left, top, width, height = bbox
    x_center = (left + width / 2.0) / img_width
    y_center = (top + height / 2.0) / img_height
    norm_w = width / img_width
    norm_h = height / img_height

    # Clip coordinates to [0.0, 1.0]
    x_center = max(0.0, min(1.0, x_center))
    y_center = max(0.0, min(1.0, y_center))
    norm_w = max(0.0, min(1.0, norm_w))
    norm_h = max(0.0, min(1.0, norm_h))

    return x_center, y_center, norm_w, norm_h


def parse_annotation_file(
    annotation_path: str,
    img_width: int,
    img_height: int
) -> List[str]:
    """
    Parses a VisDrone annotation text file and extracts human bounding boxes.
    Format per line:
      <bbox_left>,<bbox_top>,<bbox_width>,<bbox_height>,<score>,<object_category>,<truncation>,<occlusion>
    """
    yolo_lines: List[str] = []
    if not os.path.exists(annotation_path):
        return yolo_lines

    with open(annotation_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue

            parts = line_str.split(",")
            if len(parts) < 8:
                parts = line_str.split()
            if len(parts) < 8:
                continue

            try:
                bbox_left = float(parts[0])
                bbox_top = float(parts[1])
                bbox_w = float(parts[2])
                bbox_h = float(parts[3])
                category = int(parts[5])
            except ValueError:
                continue

            # Skip degenerate boxes
            if bbox_w <= 0 or bbox_h <= 0:
                continue

            # Filter exclusively for Category 1 (pedestrian) and Category 2 (people)
            if category in HUMAN_CATEGORIES:
                x_c, y_c, w, h = convert_visdrone_bbox(
                    img_width, img_height, (bbox_left, bbox_top, bbox_w, bbox_h)
                )
                # Map to single class ID 0 (human)
                yolo_lines.append(f"0 {x_c:.6f} {y_c:.6f} {w:.6f} {h:.6f}\n")

    return yolo_lines


def generate_yaml_config(
    dataset_dir: str,
    output_yaml_path: str,
    train_txt_path: str,
    val_txt_path: str
):
    """
    Generates the visdrone_human.yaml configuration for Ultralytics YOLO training.
    """
    abs_dataset_dir = os.path.abspath(dataset_dir)
    abs_train_txt = os.path.abspath(train_txt_path)
    abs_val_txt = os.path.abspath(val_txt_path)

    yaml_content = f"""# RescueLens - Edge AI Aerial Detection System
# VisDrone2019 Human Detection Dataset Configuration [B-03 RESCUE EYE]

path: {abs_dataset_dir}
train: {abs_train_txt}
val: {abs_val_txt}

# Single human target class (Categories 1: pedestrian & 2: people mapped to 0: human)
names:
  0: human
"""
    os.makedirs(os.path.dirname(os.path.abspath(output_yaml_path)), exist_ok=True)
    with open(output_yaml_path, "w", encoding="utf-8") as f:
        f.write(yaml_content)
    print(f"Generated dataset YAML configuration at: {output_yaml_path}")


def preprocess_visdrone(
    dataset_dir: str = "~/Documents/VisDrone2019-DET-train",
    val_split_ratio: float = 0.15,
    seed: int = 42,
    yaml_output: str = "model/visdrone_human.yaml"
):
    """
    Executes full preprocessing of VisDrone dataset:
    1. Converts all annotations to normalized YOLO format mapped to class 0.
    2. Splits dataset into train and val image sets.
    3. Outputs visdrone_human.yaml.
    """
    random.seed(seed)
    dataset_dir = os.path.expanduser(dataset_dir)
    images_dir = os.path.join(dataset_dir, "images")
    annotations_dir = os.path.join(dataset_dir, "annotations")
    labels_dir = os.path.join(dataset_dir, "labels")

    os.makedirs(labels_dir, exist_ok=True)

    valid_extensions = {".jpg", ".jpeg", ".png"}
    all_images = sorted([
        os.path.abspath(p) for p in glob.glob(os.path.join(images_dir, "*.*"))
        if Path(p).suffix.lower() in valid_extensions
    ])

    print(f"Found {len(all_images)} images in {images_dir}.")

    images_with_humans = []
    total_human_boxes = 0

    for idx, img_path in enumerate(all_images):
        stem = Path(img_path).stem
        annot_path = os.path.join(annotations_dir, f"{stem}.txt")
        out_label_path = os.path.join(labels_dir, f"{stem}.txt")

        w, h = get_image_dimensions(img_path)
        yolo_lines = parse_annotation_file(annot_path, w, h)

        with open(out_label_path, "w", encoding="utf-8") as f:
            f.writelines(yolo_lines)

        if len(yolo_lines) > 0:
            images_with_humans.append(img_path)
            total_human_boxes += len(yolo_lines)

        if (idx + 1) % 1000 == 0 or (idx + 1) == len(all_images):
            print(f"  Processed {idx + 1}/{len(all_images)} image annotations...")

    print("\n--- VisDrone Human Extraction Summary ---")
    print(f"Total images processed:       {len(all_images)}")
    print(f"Images containing humans:     {len(images_with_humans)}")
    print(f"Total human bounding boxes:   {total_human_boxes}")
    print(f"Labels directory:             {labels_dir}")

    # Create train / val splits prioritizing human-containing images
    random.shuffle(images_with_humans)
    val_count = int(len(images_with_humans) * val_split_ratio)
    val_images = images_with_humans[:val_count]
    train_images = images_with_humans[val_count:]

    train_txt_path = os.path.join(dataset_dir, "train.txt")
    val_txt_path = os.path.join(dataset_dir, "val.txt")

    with open(train_txt_path, "w", encoding="utf-8") as f:
        for p in train_images:
            f.write(f"{p}\n")

    with open(val_txt_path, "w", encoding="utf-8") as f:
        for p in val_images:
            f.write(f"{p}\n")

    print(f"Train images written:         {len(train_images)} -> {train_txt_path}")
    print(f"Val images written:           {len(val_images)} -> {val_txt_path}")

    # Generate visdrone_human.yaml
    generate_yaml_config(
        dataset_dir=dataset_dir,
        output_yaml_path=yaml_output,
        train_txt_path=train_txt_path,
        val_txt_path=val_txt_path
    )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Preprocess VisDrone for YOLO Human Detection")
    parser.add_argument(
        "--dataset_dir",
        type=str,
        default=os.path.expanduser("~/Documents/VisDrone2019-DET-train"),
        help="VisDrone dataset directory"
    )
    parser.add_argument(
        "--yaml_output",
        type=str,
        default="visdrone_human.yaml",
        help="Output path for dataset YAML"
    )
    args = parser.parse_args()

    preprocess_visdrone(dataset_dir=args.dataset_dir, yaml_output=args.yaml_output)
