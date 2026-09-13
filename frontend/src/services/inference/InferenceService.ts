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
    detections: (data.detections || []).map((d: any) => {
      const isArr = Array.isArray(d);
      const b = isArr ? d : (d.box || d.bbox || []);
      const conf = isArr ? d[4] : (d.confidence ?? 0);
      const label = isArr ? 'human' : (d.label || d.class || 'human');
      const x1 = isArr ? d[0] : (Array.isArray(b) ? b[0] : (b.x1 ?? b.xmin ?? d.x1 ?? d.xmin ?? 0));
      const y1 = isArr ? d[1] : (Array.isArray(b) ? b[1] : (b.y1 ?? b.ymin ?? d.y1 ?? d.ymin ?? 0));
      const x2 = isArr ? d[2] : (Array.isArray(b) ? b[2] : (b.x2 ?? b.xmax ?? d.x2 ?? d.xmax ?? 0));
      const y2 = isArr ? d[3] : (Array.isArray(b) ? b[3] : (b.y2 ?? b.ymax ?? d.y2 ?? d.ymax ?? 0));
      return {
        label,
        class: label,
        confidence: conf,
        box: [x1, y1, x2, y2],
        bbox: [x1, y1, x2, y2],
        xmin: x1,
        ymin: y1,
        xmax: x2,
        ymax: y2,
      };
    }),
    inference_time_ms: data.inference_time_ms,
    is_demo: data.is_demo ?? false,
    execution_adapter: data.execution_adapter || 'TFLite On-Device Production',
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
    detections: (data.detections || []).map((d: any) => {
      const isArr = Array.isArray(d);
      const b = isArr ? d : (d.box || d.bbox || []);
      const conf = isArr ? d[4] : (d.confidence ?? 0);
      const label = isArr ? 'human' : (d.label || d.class || 'human');
      const x1 = isArr ? d[0] : (Array.isArray(b) ? b[0] : (b.x1 ?? b.xmin ?? d.x1 ?? d.xmin ?? 0));
      const y1 = isArr ? d[1] : (Array.isArray(b) ? b[1] : (b.y1 ?? b.ymin ?? d.y1 ?? d.ymin ?? 0));
      const x2 = isArr ? d[2] : (Array.isArray(b) ? b[2] : (b.x2 ?? b.xmax ?? d.x2 ?? d.xmax ?? 0));
      const y2 = isArr ? d[3] : (Array.isArray(b) ? b[3] : (b.y2 ?? b.ymax ?? d.y2 ?? d.ymax ?? 0));
      return {
        label,
        class: label,
        confidence: conf,
        box: [x1, y1, x2, y2],
        bbox: [x1, y1, x2, y2],
        xmin: x1,
        ymin: y1,
        xmax: x2,
        ymax: y2,
      };
    }),
    inference_time_ms: data.inference_time_ms,
    is_demo: data.is_demo ?? false,
    execution_adapter: data.execution_adapter || 'TFLite On-Device Production',
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
