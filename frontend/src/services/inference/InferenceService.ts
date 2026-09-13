/// <reference types="vite/client" />

import { Detection, DroneImage } from '../../types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://127.0.0.1:8000';

export interface ParsedDetection {
  id?: string;
  label: string;
  class: 'human';
  confidence: number;
  box: [number, number, number, number];
  bbox: [number, number, number, number];
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface DetectionResult {
  count: number;
  detections: ParsedDetection[];
  inference_time_ms: number;
  is_demo: boolean;
  execution_adapter: string;
}

/**
 * Checks if a given detection label or class corresponds to a human target.
 * Robust to case-sensitivity ("human", "Human", "HUMAN"), aliases ("person", "survivor"),
 * and single-class models where label may be omitted or "0".
 */
export function isHumanTarget(target: any): boolean {
  if (!target) return true;
  let labelStr = '';
  if (typeof target === 'string') {
    labelStr = target;
  } else {
    labelStr = String(target.label ?? target.class ?? target.class_name ?? target.name ?? '');
  }
  const clean = labelStr.toLowerCase().trim();
  if (!clean) return true; // Single-class model default
  return (
    clean === 'human' ||
    clean === 'person' ||
    clean === '0' ||
    clean.includes('human') ||
    clean.includes('person') ||
    clean.includes('survivor')
  );
}

/**
 * Safely extracts the array of detections from various backend response formats.
 */
function extractDetectionsList(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.detections)) return data.detections;
  if (Array.isArray(data.data?.detections)) return data.data.detections;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.predictions)) return data.predictions;
  return [];
}

/**
 * Normalizes a raw detection item into a standardized ParsedDetection.
 */
function normalizeDetectionItem(d: any, idx: number): ParsedDetection {
  const isArr = Array.isArray(d);
  const b = isArr ? d : (d.box || d.bbox || []);
  const conf = isArr ? Number(d[4]) || 0 : Number(d.confidence ?? d.score ?? d.conf ?? 0);
  const rawLabel = isArr ? (d[5] || 'human') : (d.label || d.class || d.class_name || 'human');

  let x1 = 0;
  let y1 = 0;
  let x2 = 0;
  let y2 = 0;

  if (isArr && d.length >= 4) {
    x1 = Number(d[0]) || 0;
    y1 = Number(d[1]) || 0;
    x2 = Number(d[2]) || 0;
    y2 = Number(d[3]) || 0;
  } else if (Array.isArray(b) && b.length >= 4) {
    x1 = Number(b[0]) || 0;
    y1 = Number(b[1]) || 0;
    x2 = Number(b[2]) || 0;
    y2 = Number(b[3]) || 0;
  } else if (d.xmin !== undefined && d.xmax !== undefined) {
    x1 = Number(d.xmin) || 0;
    y1 = Number(d.ymin) || 0;
    x2 = Number(d.xmax) || 0;
    y2 = Number(d.ymax) || 0;
  } else if (d.x1 !== undefined && d.x2 !== undefined) {
    x1 = Number(d.x1) || 0;
    y1 = Number(d.y1) || 0;
    x2 = Number(d.x2) || 0;
    y2 = Number(d.y2) || 0;
  } else if (d.x !== undefined && d.width !== undefined) {
    x1 = Number(d.x) || 0;
    y1 = Number(d.y) || 0;
    x2 = x1 + (Number(d.width) || 0);
    y2 = y1 + (Number(d.height) || 0);
  }

  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);

  return {
    id: d.id || `det-${Date.now()}-${idx + 1}`,
    label: isHumanTarget(rawLabel) ? 'human' : String(rawLabel).trim(),
    class: 'human',
    confidence: Math.round(conf * 10000) / 10000,
    box: [minX, minY, maxX, maxY],
    bbox: [minX, minY, maxX, maxY],
    xmin: minX,
    ymin: minY,
    xmax: maxX,
    ymax: maxY,
  };
}

export async function detectSingleImage(file: File): Promise<DetectionResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/detect`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Detection request failed: ${response.status}`);
  }

  const rawJson = await response.json();
  const rawList = extractDetectionsList(rawJson);
  const detections = rawList.map(normalizeDetectionItem);

  const count = typeof rawJson?.count === 'number' ? rawJson.count : detections.length;

  return {
    count,
    detections,
    inference_time_ms: rawJson?.inference_time_ms ?? 0,
    is_demo: rawJson?.is_demo ?? false,
    execution_adapter: rawJson?.execution_adapter || 'TFLite On-Device Production',
  };
}

export async function processBatchImages(files: File[]): Promise<DetectionResult> {
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

  const rawJson = await response.json();
  const rawList = extractDetectionsList(rawJson);
  const detections = rawList.map(normalizeDetectionItem);

  const count = typeof rawJson?.count === 'number' ? rawJson.count : detections.length;

  return {
    count,
    detections,
    inference_time_ms: rawJson?.inference_time_ms ?? 0,
    is_demo: rawJson?.is_demo ?? false,
    execution_adapter: rawJson?.execution_adapter || 'TFLite On-Device Production',
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
