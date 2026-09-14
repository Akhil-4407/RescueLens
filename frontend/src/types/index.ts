export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type FrameStatus =
  | 'WAITING'
  | 'PROCESSING'
  | 'ANALYZED'
  | 'HUMAN_DETECTED'
  | 'NO_HUMAN'
  | 'ERROR';

export interface Detection {
  id: string;
  label?: string;
  class: 'human';
  confidence: number; // 0.0 - 1.0 (e.g. 0.94)
  x: number; // normalized 0 - 1
  y: number; // normalized 0 - 1
  width: number; // normalized 0 - 1
  height: number; // normalized 0 - 1
  box?: number[];
  bbox?: number[];
  priority: Priority;
  simulated: boolean; // explicitly marked per requirements
  hazardNotes?: string;
  waterLevel?: string;
  thermalSignature?: string;
}

export interface DroneImage {
  id: string;
  frameNumber: number;
  filename: string;
  url: string;
  status: FrameStatus;
  timestamp: string;
  altitudeMeters: number;
  compassHeading?: number;
  heading?: number;
  sector: string;
  gpsCoords: {
    lat: number;
    lng: number;
  };
  detections: Detection[];
  simulated: boolean;
  analyzedAt?: string;
  inferenceDurationMs?: number;
}

export interface MissionMetadata {
  missionId: string;
  droneId: string;
  location: string;
  modelArchitecture: string;
  runtime: string;
  execution: string;
  targetResolution: string;
  quantization: string;
  cloudVision: string;
  openAiVision: string;
  isDemoMode: boolean;
}

export interface MissionStatistics {
  totalFrames: number;
  processedFrames: number;
  waitingFrames: number;
  humansDetected: number;
  highPriorityCount: number;
  criticalPriorityCount: number;
  missionStatus: 'AWAITING DATA' | 'IN PROGRESS' | 'DEMO RESULTS' | 'COMPLETED';
  averageConfidence: number | null;
}
