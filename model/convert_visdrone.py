"""VisDrone to YOLO Format Converter for Human Detection [B-03 RESCUE EYE].

Converts VisDrone detection annotations to normalized YOLO format.
Filters strictly for human targets:
  Category 1: pedestrian
  Category 2: people
Both mapped to single class 0: human.
Generates model/visdrone_human.yaml configuration.
"""

import os
import glob
import struct
from pathlib import Path
from typing import Tuple, List, Optional
import cv2

HUMAN_CATEGORIES = {1, 2}  # 1: pedestrian, 2: people


def get_image_size(file_path: str) -> Tuple[int, int]:
    """
    Fast image dimension reader without decoding entire bitmap.
    Falls back to OpenCV if header parse fails.
    """
    try:
        with open(file_path, "rb") as f:
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
                        # SOF marker
                        sof_data = f.read(5)
                        if len(sof_data) >= 5:
                            precision, height, width = struct.unpack(">BHH", sof_data)
                            return width, height
                    else:
                        f.seek(length - 2, 1)
    except Exception:
        pass

    # Fallback to OpenCV
    im = cv2.imread(file_path)
    if im is not None:
        return im.shape[1], im.shape[0]
    return 1920, 1080


def convert_visdrone_bbox(
    img_width: int,
    img_height: int,
    bbox: Tuple[float, float, float, float]
) -> Tuple[float, float, float, float]:
    """
    Converts VisDrone [left, top, width, height] to YOLO normalized [x_center, y_center, w, h].
    """
    left, top, width, height = bbox
    x_center = (left + width / 2.0) / img_width
    y_center = (top + height / 2.0) / img_height
    norm_w = width / img_width
    norm_h = height / img_height

    # Clip to [0.0, 1.0]
    x_center = max(0.0, min(1.0, x_center))
    y_center = max(0.0, min(1.0, y_center))
    norm_w = max(0.0, min(1.0, norm_w))
    norm_h = max(0.0, min(1.0, norm_h))

    return x_center, y_center, norm_w, norm_h


def parse_visdrone_annotation_file(
    annotation_path: str,
    img_width: int,
    img_height: int
) -> List[str]:
    """
    Parses a VisDrone annotation text file and extracts human targets.
    Each line in VisDrone:
      <bbox_left>,<bbox_top>,<bbox_width>,<bbox_height>,<score>,<object_category>,<truncation>,<occlusion>
    """
    yolo_lines: List[str] = []
    if not os.path.exists(annotation_path):
        return yolo_lines

    with open(annotation_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            parts = line.strip().split(",")
            if len(parts) < 8:
                parts = line.strip().split()
            if len(parts) < 8:
                continue

            try:
                bbox_left = float(parts[0])
                bbox_top = float(parts[1])
                bbox_w = float(parts[2])
                bbox_h = float(parts[3])
                score = float(parts[4])
                category = int(parts[5])
            except ValueError:
                continue

            # Ignore zero-size boxes
            if bbox_w <= 0 or bbox_h <= 0:
                continue

            # Filter strictly for human targets (Category 1: pedestrian, 2: people)
            if category in HUMAN_CATEGORIES:
                x_c, y_c, w, h = convert_visdrone_bbox(
                    img_width, img_height, (bbox_left, bbox_top, bbox_w, bbox_h)
                )
                # Map to single class 0 (human)
                yolo_lines.append(f"0 {x_c:.6f} {y_c:.6f} {w:.6f} {h:.6f}\n")

    return yolo_lines


def generate_yaml_config(dataset_dir: str, output_yaml_path: str):
    """
    Generates a clean visdrone_human.yaml dataset configuration.
    """
    abs_dataset_dir = os.path.abspath(dataset_dir)
    yaml_content = f"""# RescueLens - Edge AI Aerial Detection System
# VisDrone2019 Human Detection Dataset Configuration [B-03 RESCUE EYE]

path: {abs_dataset_dir}  # Dataset root directory
train: images            # Train images
val: images              # Validation images

# Single target rescue class (VisDrone Categories 1 & 2 mapped to class 0)
names:
  0: human
"""
    os.makedirs(os.path.dirname(output_yaml_path), exist_ok=True)
    with open(output_yaml_path, "w", encoding="utf-8") as f:
        f.write(yaml_content)
    print(f"Generated dataset YAML configuration at: {output_yaml_path}")


def process_dataset(
    dataset_dir: str,
    output_labels_dir: Optional[str] = None,
    images_subfolder: str = "images",
    annotations_subfolder: str = "annotations",
    yaml_output: str = "model/visdrone_human.yaml"
):
    """
    Processes all images and annotations in the VisDrone dataset directory.
    """
    dataset_dir = os.path.expanduser(dataset_dir)
    images_dir = os.path.join(dataset_dir, images_subfolder)
    annotations_dir = os.path.join(dataset_dir, annotations_subfolder)

    if output_labels_dir is None:
        # Standard YOLO structure: sibling 'labels/' directory
        output_labels_dir = os.path.join(dataset_dir, "labels")

    os.makedirs(output_labels_dir, exist_ok=True)

    image_paths = sorted(glob.glob(os.path.join(images_dir, "*.*")))
    valid_extensions = {".jpg", ".jpeg", ".png"}
    image_paths = [p for p in image_paths if Path(p).suffix.lower() in valid_extensions]

    print(f"Scanning {len(image_paths)} images in {images_dir}...")

    converted_count = 0
    total_human_instances = 0
    images_with_humans = 0

    for idx, img_path in enumerate(image_paths):
        stem = Path(img_path).stem
        annot_path = os.path.join(annotations_dir, f"{stem}.txt")

        w, h = get_image_size(img_path)
        yolo_lines = parse_visdrone_annotation_file(annot_path, w, h)
        out_path = os.path.join(output_labels_dir, f"{stem}.txt")

        with open(out_path, "w", encoding="utf-8") as f:
            f.writelines(yolo_lines)

        count = len(yolo_lines)
        total_human_instances += count
        if count > 0:
            images_with_humans += 1
        converted_count += 1

        if (idx + 1) % 1000 == 0 or (idx + 1) == len(image_paths):
            print(f"Processed {idx + 1}/{len(image_paths)} images...")

    print("\n--- VisDrone Conversion Summary ---")
    print(f"Total images converted: {converted_count}")
    print(f"Images containing human targets: {images_with_humans}")
    print(f"Total human instances extracted: {total_human_instances}")
    print(f"YOLO label files saved to: {output_labels_dir}")

    # Generate visdrone_human.yaml
    generate_yaml_config(dataset_dir, yaml_output)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Convert VisDrone dataset to YOLO human format")
    parser.add_argument(
        "--dataset_dir",
        type=str,
        default=os.path.expanduser("~/Documents/VisDrone2019-DET-train"),
        help="Path to VisDrone2019-DET-train directory"
    )
    parser.add_argument(
        "--output_labels",
        type=str,
        default=None,
        help="Path to output YOLO labels directory (defaults to dataset_dir/labels)"
    )
    parser.add_argument(
        "--yaml_output",
        type=str,
        default="model/visdrone_human.yaml",
        help="Output YAML configuration path"
    )
    args = parser.parse_args()

    process_dataset(args.dataset_dir, args.output_labels, yaml_output=args.yaml_output)
