# RescueLens Backend - Production Container
FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    MODEL_PATH=/app/yolo_tiny_rescue.tflite

WORKDIR /app

# Install minimal system dependencies required for OpenCV and health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python production dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model weights and application source code
COPY yolo_tiny_rescue.tflite .
COPY src ./src

# Expose backend port
EXPOSE 8000

# Docker healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Serve FastAPI via Uvicorn
CMD ["uvicorn", "backend.main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]
