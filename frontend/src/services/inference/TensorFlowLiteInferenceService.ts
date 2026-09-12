import { Detection, DroneImage } from '../../types';
import { InferenceEngineInfo, InferenceService } from './InferenceService';

/**
 * TensorFlowLiteInferenceService
 *
 * Drop-in client-side inference adapter designed for TensorFlow Lite Wasm / WebGL
 * executing YOLO Tiny quantized INT8 weights on the user device.
 *
 * This adapter is explicitly marked as "DROP-IN TARGET" until .tflite weights are mounted.
 */
export class TensorFlowLiteInferenceService implements InferenceService {
  readonly id = 'tflite-yolo-tiny';
  readonly name = 'TensorFlowLiteInferenceService';
  private modelWeightsUrl: string | null = null;
  private isLoaded = false;

  constructor(modelWeightsUrl?: string) {
    this.modelWeightsUrl = modelWeightsUrl || null;
  }

  getEngineInfo(): InferenceEngineInfo {
    return {
      name: 'TensorFlowLiteInferenceService',
      type: 'tflite',
      status: 'DROP-IN TARGET',
      modelArchitecture: 'YOLO TINY',
      executionFramework: 'TENSORFLOW LITE — CLIENT SIDE',
      targetResolution: '416 × 416 × 3 RGB',
      quantization: 'INT8',
      cloudVision: 'DISABLED',
      openAiVision: 'DISABLED',
      isSimulated: false,
      notes:
        'Awaiting deployment of compiled on-device .tflite model weights. Ingests raw canvas pixel buffers (Uint8ClampedArray) resized to 416x416 without cloud transmission.',
    };
  }

  isModelReady(): boolean {
    return this.isLoaded;
  }

  async loadModel(): Promise<boolean> {
    if (!this.modelWeightsUrl) {
      console.warn(
        '[TensorFlowLiteInferenceService] Awaiting on-device .tflite model weights URL. MockInferenceService is active for demo.'
      );
      return false;
    }
    // Ready for tf.lite.loadTFLiteModel() integration
    return true;
  }

  async runInference(
    _frame: DroneImage,
    _imageElement?: HTMLImageElement | HTMLCanvasElement
  ): Promise<Detection[]> {
    if (!this.isLoaded) {
      throw new Error(
        'TensorFlowLite model not ready: Drop-in target requires compiled TFLite weights. Switch to MockInferenceService for operational demo.'
      );
    }
    return [];
  }
}
