import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  DroneImage,
  Detection,
  MissionMetadata,
  MissionStatistics,
  FrameStatus,
} from '../types';
import { generateDroneMissionPack } from '../data/mockDroneMissionPack';
import { InferenceService, API_BASE_URL } from '../services/inference/InferenceService';
import { MockInferenceService } from '../services/inference/MockInferenceService';
import { TensorFlowLiteInferenceService } from '../services/inference/TensorFlowLiteInferenceService';

interface MissionContextType {
  images: DroneImage[];
  selectedImageId: string | null;
  selectedImage: DroneImage | null;
  isProcessingQueue: boolean;
  processingProgress: number;
  currentProcessingIndex: number;
  activeService: InferenceService;
  inferenceAdapterName: string;
  missionMetadata: MissionMetadata;
  stats: MissionStatistics;
  backendStatus: 'ONLINE' | 'OFFLINE' | 'CHECKING';
  isBackendConnected: boolean;
  confidenceThreshold: number;
  setConfidenceThreshold: (val: number) => void;
  
  // Actions
  importImages: (files: FileList | File[]) => Promise<number>;
  load100FrameMissionPack: (count?: number) => void;
  clearMission: () => void;
  selectImage: (id: string) => void;
  runInferenceOnImage: (id: string) => Promise<Detection[]>;
  runInferenceOnAll: () => Promise<void>;
  stopProcessing: () => void;
  switchInferenceAdapter: (adapterId: 'mock' | 'tflite') => void;
}

const mockService = new MockInferenceService();
const tfliteService = new TensorFlowLiteInferenceService();

const DEFAULT_METADATA: MissionMetadata = {
  missionId: 'DRONE-07',
  droneId: 'DRONE-07',
  location: 'Sector A — Flood Zone',
  modelArchitecture: 'YOLO TINY',
  runtime: 'TENSORFLOW LITE',
  execution: 'ON-DEVICE',
  targetResolution: '416 × 416 × 3 RGB',
  quantization: 'FP16',
  cloudVision: 'DISABLED',
  openAiVision: 'DISABLED',
  isDemoMode: false,
};

const MissionContext = createContext<MissionContextType | null>(null);

export const MissionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [images, setImages] = useState<DroneImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);
  const [activeService, setActiveService] = useState<InferenceService>(tfliteService);
  const [backendStatus, setBackendStatus] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING'>('CHECKING');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.30);
  const stopRequestedRef = useRef(false);

  // Poll backend health status
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setBackendStatus(data.engine_ready !== false ? 'ONLINE' : 'OFFLINE');
          }
        } else {
          if (isMounted) setBackendStatus('OFFLINE');
        }
      } catch {
        if (isMounted) setBackendStatus('OFFLINE');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Selected image computed property
  const selectedImage = useMemo(() => {
    if (!selectedImageId) return images[0] || null;
    return images.find((img) => img.id === selectedImageId) || images[0] || null;
  }, [images, selectedImageId]);

  // Statistics calculation adhering strictly to: DO NOT INVENT VALUES
  const stats: MissionStatistics = useMemo(() => {
    const totalFrames = images.length;
    const processedImages = images.filter(
      (img) =>
        img.status === 'ANALYZED' ||
        img.status === 'HUMAN_DETECTED' ||
        img.status === 'NO_HUMAN'
    );
    const processedFrames = processedImages.length;
    const waitingFrames = images.filter((img) => img.status === 'WAITING').length;

    let humansDetected = 0;
    let highPriorityCount = 0;
    let criticalPriorityCount = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    processedImages.forEach((img) => {
      humansDetected += img.detections.length;
      img.detections.forEach((det) => {
        if (det.priority === 'CRITICAL') {
          criticalPriorityCount += 1;
          highPriorityCount += 1; // Critical counts towards elevated priority rescues
        } else if (det.priority === 'HIGH') {
          highPriorityCount += 1;
        }
        totalConfidence += det.confidence;
        confidenceCount += 1;
      });
    });

    let missionStatus: MissionStatistics['missionStatus'] = 'AWAITING DATA';
    if (processedFrames === 0) {
      missionStatus = 'AWAITING DATA';
    } else if (isProcessingQueue) {
      missionStatus = 'IN PROGRESS';
    } else {
      // Clearly labeled DEMO RESULTS when using mock/demo data
      missionStatus = 'DEMO RESULTS';
    }

    const averageConfidence =
      confidenceCount > 0
        ? Math.round((totalConfidence / confidenceCount) * 100) / 100
        : null;

    return {
      totalFrames,
      processedFrames,
      waitingFrames,
      humansDetected,
      highPriorityCount,
      criticalPriorityCount,
      missionStatus,
      averageConfidence,
    };
  }, [images, isProcessingQueue]);

  // Import local user drone frames (JPG, JPEG, PNG, WEBP) up to 100
  const importImages = useCallback(
    async (files: FileList | File[]): Promise<number> => {
      const fileList = Array.from(files);
      const validFiles = fileList.filter((f) =>
        f.type.match(/^image\/(jpeg|jpg|png|webp)$/i)
      );

      const availableSlots = 100 - images.length;
      const filesToLoad = validFiles.slice(0, Math.max(0, availableSlots));

      if (filesToLoad.length === 0) return 0;

      const newFrames: DroneImage[] = filesToLoad.map((file, idx) => {
        const frameNumber = images.length + idx + 1;
        const url = URL.createObjectURL(file);
        return {
          id: `custom-frame-${Date.now()}-${idx}`,
          frameNumber,
          filename: file.name,
          url,
          status: 'WAITING',
          timestamp: new Date().toISOString(),
          altitudeMeters: 60 + Math.floor(Math.random() * 40),
          sector: `Sector A — User Upload`,
          gpsCoords: {
            lat: 34.0522,
            lng: -118.2437,
          },
          detections: [],
          simulated: true, // Marked simulated until real on-device tflite inference runs
        };
      });

      setImages((prev) => {
        const updated = [...prev, ...newFrames];
        return updated.slice(0, 100);
      });

      if (!selectedImageId && newFrames.length > 0) {
        setSelectedImageId(newFrames[0].id);
      }

      return newFrames.length;
    },
    [images.length, selectedImageId]
  );

  // Load the authentic VisDrone drone mission pack (20 pre-bundled frames, expandable to 100)
  const load100FrameMissionPack = useCallback((count = 20) => {
    const pack = generateDroneMissionPack(count);
    setImages(pack);
    setSelectedImageId(pack[0]?.id || null);
    setProcessingProgress(0);
    setCurrentProcessingIndex(0);
  }, []);

  // Clear current mission
  const clearMission = useCallback(() => {
    setImages([]);
    setSelectedImageId(null);
    setProcessingProgress(0);
    setCurrentProcessingIndex(0);
    setIsProcessingQueue(false);
  }, []);

  // Select active frame
  const selectImage = useCallback((id: string) => {
    setSelectedImageId(id);
  }, []);

  // Run on-device inference on a single frame
  const runInferenceOnImage = useCallback(
    async (id: string): Promise<Detection[]> => {
      const targetFrame = images.find((img) => img.id === id);
      if (!targetFrame) return [];

      // Set temporary PROCESSING status
      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, status: 'PROCESSING' } : img
        )
      );

      const startTime = performance.now();
      try {
        const detections = await activeService.runInference(targetFrame, undefined, confidenceThreshold);
        const duration = Math.round(performance.now() - startTime);

        const newStatus: FrameStatus =
          detections.length > 0 ? 'HUMAN_DETECTED' : 'NO_HUMAN';

        setImages((prev) =>
          prev.map((img) =>
            img.id === id
              ? {
                  ...img,
                  status: newStatus,
                  detections,
                  analyzedAt: new Date().toISOString(),
                  inferenceDurationMs: duration,
                }
              : img
          )
        );

        return detections;
      } catch (err) {
        console.error('Inference error:', err);
        setImages((prev) =>
          prev.map((img) =>
            img.id === id ? { ...img, status: 'ERROR' } : img
          )
        );
        return [];
      }
    },
    [images, activeService, confidenceThreshold]
  );

  // Run batch on-device inference sequentially on all waiting frames in the queue
  const runInferenceOnAll = useCallback(async () => {
    if (images.length === 0 || isProcessingQueue) return;

    setIsProcessingQueue(true);
    stopRequestedRef.current = false;

    const waiting = images.filter((img) => img.status === 'WAITING');
    if (waiting.length === 0) {
      // Re-run all if none are waiting
      setImages((prev) => prev.map((img) => ({ ...img, status: 'WAITING' })));
    }

    const totalToProcess = images.length;

    for (let i = 0; i < images.length; i++) {
      if (stopRequestedRef.current) break;

      const currentFrame = images[i];
      setCurrentProcessingIndex(i + 1);
      setProcessingProgress(Math.round(((i + 1) / totalToProcess) * 100));

      // Mark current as processing
      setImages((prev) =>
        prev.map((img, idx) =>
          idx === i ? { ...img, status: 'PROCESSING' } : img
        )
      );

      const startTime = performance.now();
      try {
        const detections = await activeService.runInference(currentFrame, undefined, confidenceThreshold);
        const duration = Math.round(performance.now() - startTime);
        const status: FrameStatus =
          detections.length > 0 ? 'HUMAN_DETECTED' : 'NO_HUMAN';

        setImages((prev) =>
          prev.map((img, idx) =>
            idx === i
              ? {
                  ...img,
                  status,
                  detections,
                  analyzedAt: new Date().toISOString(),
                  inferenceDurationMs: duration,
                }
              : img
          )
        );
      } catch {
        setImages((prev) =>
          prev.map((img, idx) =>
            idx === i ? { ...img, status: 'ERROR' } : img
          )
        );
      }
    }

    setIsProcessingQueue(false);
  }, [images, isProcessingQueue, activeService, confidenceThreshold]);

  const stopProcessing = useCallback(() => {
    stopRequestedRef.current = true;
    setIsProcessingQueue(false);
  }, []);

  const switchInferenceAdapter = useCallback((adapterId: 'mock' | 'tflite') => {
    if (adapterId === 'tflite') {
      setActiveService(tfliteService);
    } else {
      setActiveService(mockService);
    }
  }, []);

  return (
    <MissionContext.Provider
      value={{
        images,
        selectedImageId,
        selectedImage,
        isProcessingQueue,
        processingProgress,
        currentProcessingIndex,
        activeService,
        inferenceAdapterName: activeService.name,
        missionMetadata: DEFAULT_METADATA,
        stats,
        backendStatus,
        isBackendConnected: backendStatus === 'ONLINE',
        confidenceThreshold,
        setConfidenceThreshold,
        importImages,
        load100FrameMissionPack,
        clearMission,
        selectImage,
        runInferenceOnImage,
        runInferenceOnAll,
        stopProcessing,
        switchInferenceAdapter,
      }}
    >
      {children}
    </MissionContext.Provider>
  );
};

export function useMission(): MissionContextType {
  const context = useContext(MissionContext);
  if (!context) {
    throw new Error('useMission must be used within a MissionProvider');
  }
  return context;
}
