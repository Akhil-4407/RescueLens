import { Detection, DroneImage, Priority } from '../../types';
import { InferenceEngineInfo, InferenceService } from './InferenceService';

/**
 * MockInferenceService provides deterministic simulated on-device human detection
 * for the search & rescue pipeline until the TFLite/YOLO model weights are linked.
 *
 * All outputs explicitly carry `simulated: true` flags per requirements.
 */
export class MockInferenceService implements InferenceService {
  readonly id = 'mock-inference';
  readonly name = 'MockInferenceService';
  private modelLoaded = false;

  getEngineInfo(): InferenceEngineInfo {
    return {
      name: 'MockInferenceService',
      type: 'mock',
      status: 'ACTIVE — DEMO',
      modelArchitecture: 'YOLO TINY',
      executionFramework: 'TENSORFLOW LITE — CLIENT SIDE',
      targetResolution: '416 × 416 × 3 RGB',
      quantization: 'INT8',
      cloudVision: 'DISABLED',
      openAiVision: 'DISABLED',
      isSimulated: true,
      notes:
        'Deterministic mock inference service for architecture validation and operational UI testing. Replaced by TensorFlowLiteInferenceService once on-device wasm weights are loaded.',
    };
  }

  isModelReady(): boolean {
    return this.modelLoaded;
  }

  async loadModel(): Promise<boolean> {
    // Simulated on-device model initialization
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.modelLoaded = true;
    return true;
  }

  /**
   * Runs simulated on-device computer vision inference on a drone frame.
   * Deterministically identifies human survivors, roof-stranded individuals, or debris signals.
   */
  async runInference(
    frame: DroneImage,
    _imageElement?: HTMLImageElement | HTMLCanvasElement,
    confidenceThreshold: number = 0.30
  ): Promise<Detection[]> {
    // Ensure model is marked ready
    if (!this.modelLoaded) {
      await this.loadModel();
    }

    // Simulate realistic on-device preprocessing and inference delay (180ms - 320ms)
    await new Promise((resolve) => setTimeout(resolve, 240));

    // If frame already has curated scenario detections (from mission pack), filter by confidenceThreshold
    if (frame.detections && frame.detections.length > 0) {
      return frame.detections
        .filter((d) => d.confidence >= confidenceThreshold)
        .map((d) => ({
          ...d,
          simulated: true,
        }));
    }

    // Deterministic simulation based on frame number or ID hash
    const seed = this.hashString(frame.id + frame.filename);
    const hasDetections = (seed % 10) < 6; // 60% of rescue operational frames have detections

    if (!hasDetections) {
      return [];
    }

    const detectionsCount = (seed % 3) + 1; // 1 to 3 detections
    const detections: Detection[] = [];

    const priorities: Priority[] = ['CRITICAL', 'HIGH', 'HIGH', 'MEDIUM', 'LOW'];

    for (let i = 0; i < detectionsCount; i++) {
      const subSeed = (seed * (i + 7) + 13) % 1000;
      const confidence = Math.round((0.78 + (subSeed % 20) * 0.01) * 100) / 100;
      
      // Calculate normalized bounding box within 0.15 - 0.85 bounds
      const x = Math.round((0.2 + ((subSeed * 3) % 55) / 100) * 1000) / 1000;
      const y = Math.round((0.2 + ((subSeed * 5) % 55) / 100) * 1000) / 1000;
      const width = Math.round((0.08 + (subSeed % 8) / 100) * 1000) / 1000;
      const height = Math.round((0.10 + (subSeed % 10) / 100) * 1000) / 1000;

      const priority = priorities[(seed + i) % priorities.length];

      detections.push({
        id: `det-${frame.id}-${i + 1}`,
        class: 'human',
        confidence: Math.min(0.98, Math.max(0.72, confidence)),
        x: Math.min(0.85, x),
        y: Math.min(0.85, y),
        width,
        height,
        priority,
        simulated: true,
        hazardNotes:
          priority === 'CRITICAL'
            ? 'Water level rising, immediate airlift recommended'
            : priority === 'HIGH'
            ? 'Stranded on elevated structure, signaling distress'
            : 'Static subject spotted in perimeter shelter',
        thermalSignature: `${(36.2 + (subSeed % 12) * 0.1).toFixed(1)}°C Signature`,
      });
    }

    return detections;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
