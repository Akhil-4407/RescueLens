/// <reference types="vite/client" />

import { Detection, DroneImage } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export async function detectSingleImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/detect`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Detection request failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    count: data.count,
    detections: (data.detections || []).map((d: any[]) => ({
      box: { x1: d[0], y1: d[1], x2: d[2], y2: d[3] },
      confidence: d[4],
    })),
    inference_time_ms: data.inference_time_ms,
  };
}

export async function processBatchImages(files: File[]) {
  const formData = new FormData();
  files.slice(0, 100).forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE_URL}/api/batch-process`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Batch processing request failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    count: data.count,
    detections: (data.detections || []).map((d: any[]) => ({
      box: { x1: d[0], y1: d[1], x2: d[2], y2: d[3] },
      confidence: d[4],
    })),
    inference_time_ms: data.inference_time_ms,
  };
}

export interface InferenceEngineInfo {
  name: string;
  type: 'mock' | 'tflite' | 'yolo_wasm';
  status: 'ACTIVE — DEMO' | 'DROP-IN TARGET' | 'INITIALIZING' | 'READY' | 'ERROR';
  modelArchitecture: string;
  executionFramework: string;
  targetResolution: string;
  quantization: string;
  cloudVision: string;
  openAiVision: string;
  isSimulated: boolean;
  notes: string;
}

export interface InferenceService {
  readonly id: string;
  readonly name: string;
  getEngineInfo(): InferenceEngineInfo;
  isModelReady(): boolean;
  loadModel(): Promise<boolean>;
  runInference(
    frame: DroneImage,
    imageElement?: HTMLImageElement | HTMLCanvasElement
  ): Promise<Detection[]>;
}
