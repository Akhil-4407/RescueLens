"""VisDrone to YOLO Format Converter for Human Detection [B-03 RESCUE EYE].

Converts VisDrone detection annotations to normalized YOLO format.
Filters strictly for human targets:
  Category 1: pedestrian
  Category 2: people
Both mapped to class 0: human.
"""

import os
import glob
from pathlib import Path
from typing import Tuple, List, Optional
import cv2

HUMAN_CATEGORIES = {1, 2}  # 1: pedestrian, 2: people


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

    with open(annotation_path, "r", encoding="utf-8") as f:
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


def process_dataset(
    dataset_dir: str,
    output_labels_dir: str,
    images_subfolder: str = "images",
    annotations_subfolder: str = "annotations"
):
    """
    Processes all images and annotations in the dataset directory.
    """
    images_dir = os.path.join(dataset_dir, images_subfolder)
    annotations_dir = os.path.join(dataset_dir, annotations_subfolder)

    os.makedirs(output_labels_dir, exist_ok=True)

    image_paths = sorted(glob.glob(os.path.join(images_dir, "*.*")))
    valid_extensions = {".jpg", ".jpeg", ".png"}
    image_paths = [p for p in image_paths if Path(p).suffix.lower() in valid_extensions]

    print(f"Found {len(image_paths)} images in {images_dir}")

    converted_count = 0
    total_human_instances = 0

    for img_path in image_paths:
        stem = Path(img_path).stem
        annot_path = os.path.join(annotations_dir, f"{stem}.txt")

        # Read image dimensions
        img = cv2.imread(img_path)
        if img is None:
            continue
        h, w = img.shape[:2]

        yolo_lines = parse_visdrone_annotation_file(annot_path, w, h)
        out_path = os.path.join(output_labels_dir, f"{stem}.txt")

        with open(out_path, "w", encoding="utf-8") as f:
            f.writelines(yolo_lines)

        total_human_instances += len(yolo_lines)
        converted_count += 1

    print(f"Successfully processed {converted_count} images.")
    print(f"Extracted {total_human_instances} human target instances.")


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
        "--output_dir",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "converted_labels"),
        help="Path to output YOLO labels directory"
    )
    args = parser.parse_args()

    process_dataset(args.dataset_dir, args.output_dir)
