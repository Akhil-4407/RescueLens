# RescueLens Model Training & Quantization Pipeline [B-03 RESCUE EYE]

This directory contains the dedicated model pipeline for training, converting, and exporting drone-specific YOLO-tiny / nano architectures on the VisDrone dataset.

---

## 1. Dataset Specification: VisDrone2019-DET

- **Source Dataset Location**: `~/Documents/VisDrone2019-DET-train`
- **Raw Annotation Format**:
  `[bbox_left, bbox_top, bbox_width, bbox_height, score, object_category, truncation, occlusion]`
- **Class Filtering**:
  - **Category 1**: `pedestrian`
  - **Category 2**: `people`
  - Both human categories are unified into a single target class: `0: human`.
  - All non-human categories (vehicles, bicycles, vans, etc.) are excluded.
- **YOLO Target Format**:
  `<class_id> <x_center> <y_center> <width> <height>` (coordinates normalized to `[0.0, 1.0]`).

---

## 2. Model Architecture & Specifications

| Parameter | Specification |
| :--- | :--- |
| **Architecture** | YOLO-tiny / YOLOv8n Edge-Optimized |
| **Input Shape** | `[1, 416, 416, 3]` (RGB, normalized to `[0.0, 1.0]`) |
| **Output Tensor Format** | `[1, num_boxes, 5]` (`[cx, cy, w, h, confidence]`) |
| **Quantization** | FP16 / INT8 for CPU edge acceleration via XNNPACK |
| **Accuracy Target** | $>80\%$ precision on the human class |
| **Execution Framework**| TensorFlow Lite (`tf.lite.Interpreter`) on-device |

---

## 3. Pipeline Scripts

1. **`convert_visdrone.py`**:
   Parses raw VisDrone annotations, filters for human classes (`1` and `2`), normalizes bounding boxes, and writes standard YOLO label files.
   ```bash
   python model/convert_visdrone.py --dataset_dir ~/Documents/VisDrone2019-DET-train --output_dir model/converted_labels
   ```

2. **`visdrone_human.yaml`**:
   YOLO dataset configuration defining the paths and single `human` class.

3. **`train.py`**:
   Fine-tunes the lightweight architecture on the filtered aerial dataset with small-object aerial hyperparameters.
   ```bash
   python model/train.py --data model/visdrone_human.yaml --epochs 50 --imgsz 416 --batch 16
   ```

4. **`export_tflite.py`**:
   Converts trained weights to TensorFlow Lite format with quantization enabled, copying the finalized model to `backend/yolo_tiny_rescue.tflite`.
   ```bash
   python model/export_tflite.py --weights runs/train/visdrone_human_model/weights/best.pt --imgsz 416 --output backend/yolo_tiny_rescue.tflite
   ```

---

## 4. On-Device Tiling & Inference Pipeline

Because aerial drone targets are small (often 10–50 pixels), resizing full high-resolution frames (e.g. 1920x1080) directly into 416x416 destroys pixel resolution. The production backend implements:
- **Overlapping Image Slicing**: Splits the frame into 416x416 tiles with a **20% overlap stride** (`stride = 332px`).
- **Tile-Level Inference**: Evaluates each tile on-device with the TFLite interpreter.
- **Coordinate Mapping**: Projects bounding boxes back to global image coordinates.
- **Global NMS**: Eliminates overlapping candidate duplicates with `IOU_THRESHOLD = 0.40`.
- **Confidence Filtering**: Enforces the $>80\%$ confidence threshold required by [B-03].
