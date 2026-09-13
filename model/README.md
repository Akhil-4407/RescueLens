# RescueLens Model Training Pipeline [B-03 RESCUE EYE]

Production-ready edge AI training and deployment pipeline generating an on-device quantized YOLO-tiny model optimized for aerial drone imagery human detection.

## Architecture & Pipeline Overview

1. **Environment Setup**: Isolated Python 3.11 environment managed with `uv` containing `torch`, `torchvision`, `ultralytics`, `mlx`, and `tensorflow`.
2. **Dataset Preprocessing (`convert_visdrone.py`)**:
   - Parses VisDrone2019 detection annotations (`6,471` images).
   - Filters exclusively for human targets: Category 1 (`pedestrian`) and Category 2 (`people`).
   - Normalizes coordinates and maps both categories to target class `0: human`.
   - Generates train/validation splits and `visdrone_human.yaml`.
3. **Hardware-Accelerated Training (`train.py`)**:
   - Explicitly utilizes Apple Silicon Metal Performance Shaders (`mps`) backend for local hardware acceleration on M5 silicon.
   - Fine-tunes YOLO-tiny architecture at 416x416 resolution (matching backend tiling stride).
   - Trains for at least 50 epochs targeting >80% accuracy.
4. **Quantization & Export (`export_tflite.py`)**:
   - Exports trained PyTorch weights to quantized TensorFlow Lite FlatBuffer (`.tflite`).
   - Targets FP16 / INT8 precision for low-latency on-device inference.
   - Output tensor shape: `[1, 5, 3549]` (4 bounding box coordinates + 1 human confidence per anchor).
5. **FastAPI Deployment**:
   - Deployed directly to `backend/yolo_tiny_rescue.tflite` for instantaneous on-device inference.

## Quickstart

### 1. Environment Setup
```bash
cd model
uv venv .venv --python 3.11
source .venv/bin/activate
uv pip install -r pyproject.toml
```

### 2. Preprocess VisDrone Dataset
```bash
python convert_visdrone.py --dataset_dir ~/Documents/VisDrone2019-DET-train
```

### 3. Train on Apple Silicon M5 (MPS Acceleration)
```bash
python train.py --epochs 50 --batch 16 --imgsz 416 --quantization fp16
```

### 4. Export to Quantized TFLite
```bash
python export_tflite.py --weights weights/best.pt --output ../backend/yolo_tiny_rescue.tflite --quantization fp16
```
