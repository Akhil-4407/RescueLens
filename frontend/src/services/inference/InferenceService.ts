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
    detections: (data.detections || []).map((d: any[]) => {
      const isArr = Array.isArray(d);
      const b = isArr ? d : ((d as any)?.box || []);
      const conf = isArr ? d[4] : ((d as any)?.confidence ?? 0);
      return {
        box: {
          x1: isArr ? d[0] : (b[0] ?? (d as any)?.x1 ?? 0),
          y1: isArr ? d[1] : (b[1] ?? (d as any)?.y1 ?? 0),
          x2: isArr ? d[2] : (b[2] ?? (d as any)?.x2 ?? 0),
          y2: isArr ? d[3] : (b[3] ?? (d as any)?.y2 ?? 0),
        },
        confidence: conf,
      };
    }),
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
    detections: (data.detections || []).map((d: any[]) => {
      const isArr = Array.isArray(d);
      const b = isArr ? d : ((d as any)?.box || []);
      const conf = isArr ? d[4] : ((d as any)?.confidence ?? 0);
      return {
        box: {
          x1: isArr ? d[0] : (b[0] ?? (d as any)?.x1 ?? 0),
          y1: isArr ? d[1] : (b[1] ?? (d as any)?.y1 ?? 0),
          x2: isArr ? d[2] : (b[2] ?? (d as any)?.x2 ?? 0),
          y2: isArr ? d[3] : (b[3] ?? (d as any)?.y2 ?? 0),
        },
        confidence: conf,
      };
    }),
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
