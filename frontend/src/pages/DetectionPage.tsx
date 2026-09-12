import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Cpu,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Flame,
  Clock,
  Sparkles,
  Info,
  CheckCircle,
} from 'lucide-react';
import { useMission } from '../state/MissionContext';
import { DetectionCanvas } from '../components/DetectionCanvas';
import { Detection, Priority } from '../types';

export const DetectionPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    images,
    selectedImage,
    selectImage,
    runInferenceOnImage,
    load100FrameMissionPack,
    activeService,
  } = useMission();

  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [isInferring, setIsInferring] = useState(false);

  // If no images exist, show refined minimal empty state per Section 5
  if (images.length === 0) {
    return (
      <div
        id="detection-page-no-images"
        className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center justify-center min-h-[60vh]"
      >
        <div className="relative p-8 sm:p-12 rounded-xl border border-white/15 bg-black/60 backdrop-blur-md technical-grid w-full">
          {/* Subtle corner framing */}
          <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t border-l border-white/40 pointer-events-none" />
          <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t border-r border-white/40 pointer-events-none" />
          <div className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b border-l border-white/40 pointer-events-none" />
          <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b border-r border-white/40 pointer-events-none" />

          <div className="w-14 h-14 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mx-auto mb-5 text-white/80">
            <Cpu className="w-7 h-7 text-white" />
          </div>

          <span className="text-[11px] font-mono tracking-widest text-[#9a9a9a] uppercase block mb-1">
            ON-DEVICE WORKSTATION IDLE
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2 uppercase font-sans">
            No Drone Images Ingested
          </h2>
          <p className="text-sm text-[#9a9a9a] max-w-md mx-auto mb-7 font-sans leading-relaxed">
            Load the pre-configured 100-frame drone mission pack or import raw drone imagery on the Mission page to inspect computer-vision detections.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              id="btn-detection-load-pack"
              onClick={load100FrameMissionPack}
              className="btn-metallic-primary px-6 py-2.5 text-sm metallic-shine"
            >
              LOAD 100-FRAME MISSION PACK
            </button>
            <button
              onClick={() => navigate('/mission')}
              className="btn-metallic-ghost px-6 py-2.5 text-sm"
            >
              Go to Mission Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Frame navigation indices
  const currentIndex = selectedImage
    ? images.findIndex((img) => img.id === selectedImage.id)
    : 0;

  const handlePrevFrame = () => {
    if (currentIndex > 0) {
      selectImage(images[currentIndex - 1].id);
      setSelectedDetection(null);
    }
  };

  const handleNextFrame = () => {
    if (currentIndex < images.length - 1) {
      selectImage(images[currentIndex + 1].id);
      setSelectedDetection(null);
    }
  };

  const handleRunInference = async () => {
    if (!selectedImage) return;
    setIsInferring(true);
    try {
      const detections = await runInferenceOnImage(selectedImage.id);
      if (detections.length > 0) {
        setSelectedDetection(detections[0]);
      } else {
        setSelectedDetection(null);
      }
    } finally {
      setIsInferring(false);
    }
  };

  // Compute metrics for detection panel strictly without inventing values
  const isAnalyzed =
    selectedImage &&
    (selectedImage.status === 'ANALYZED' ||
      selectedImage.status === 'HUMAN_DETECTED' ||
      selectedImage.status === 'NO_HUMAN');

  const detections = selectedImage?.detections || [];
  const humansDetectedCount = isAnalyzed ? detections.length : null;

  // Max confidence calculation
  const maxConfidence =
    isAnalyzed && detections.length > 0
      ? Math.round(
          Math.max(...detections.map((d) => d.confidence)) * 100
        )
      : null;

  // Overall highest priority for this frame
  const highestPriority: Priority | null =
    isAnalyzed && detections.length > 0
      ? detections.some((d) => d.priority === 'CRITICAL')
        ? 'CRITICAL'
        : detections.some((d) => d.priority === 'HIGH')
        ? 'HIGH'
        : detections.some((d) => d.priority === 'MEDIUM')
        ? 'MEDIUM'
        : 'LOW'
      : null;

  return (
    <div id="detection-page" className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-5 flex flex-col gap-4">
      {/* Top Breadcrumb & Frame Pager */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#9a9a9a]">
            DETECTION STATION
          </span>
          <span className="text-white/20 font-mono">/</span>
          <span className="text-sm font-semibold font-mono text-white">
            FRAME {String(currentIndex + 1).padStart(2, '0')} OF {images.length}
          </span>
        </div>

        {/* Previous / Next Frame controls */}
        <div className="flex items-center gap-2">
          <button
            id="btn-prev-frame"
            onClick={handlePrevFrame}
            disabled={currentIndex === 0}
            className="btn-metallic-ghost px-3 py-1.5 text-xs disabled:opacity-30"
            title="Previous Frame"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <span className="text-xs font-mono text-[#9a9a9a] px-1">
            {currentIndex + 1} / {images.length}
          </span>

          <button
            id="btn-next-frame"
            onClick={handleNextFrame}
            disabled={currentIndex >= images.length - 1}
            className="btn-metallic-ghost px-3 py-1.5 text-xs disabled:opacity-30"
            title="Next Frame"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 70% / 30% Grid Layout on Desktop per Section 6 (10-column: 7 cols viewer, 3 cols panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-start">
        {/* DOMINANT DRONE IMAGE VIEWER: ~70% (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <DetectionCanvas
            image={selectedImage}
            selectedDetectionId={selectedDetection?.id}
            onSelectDetection={(det) => setSelectedDetection(det)}
          />

          {/* Clean Telemetry Strip Below Viewer */}
          {selectedImage && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-black/50 border border-white/10 text-xs text-[#9a9a9a]">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-[#9a9a9a]">FILE:</span>
                <span className="font-mono text-white text-[11px]">{selectedImage.filename}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-[#9a9a9a]">ALTITUDE:</span>
                <span className="font-mono text-white text-[11px]">{selectedImage.altitudeMeters}m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-[#9a9a9a]">STATUS:</span>
                <span
                  className={`font-mono text-[11px] ${
                    selectedImage.status === 'HUMAN_DETECTED'
                      ? 'text-amber-400 font-semibold'
                      : selectedImage.status === 'NO_HUMAN'
                      ? 'text-emerald-400'
                      : 'text-white/70'
                  }`}
                >
                  {selectedImage.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-[#9a9a9a]">SECTOR:</span>
                <span className="font-mono text-white text-[11px]">{selectedImage.sector}</span>
              </div>
            </div>
          )}
        </div>

        {/* DETECTION INTELLIGENCE PANEL: ~30% (3 cols on lg) */}
        <div
          id="detection-intelligence-panel"
          className="lg:col-span-3 flex flex-col gap-4 p-5 rounded-xl border border-white/15 bg-black/70 backdrop-blur-md"
        >
          {/* Panel Header */}
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#9a9a9a] uppercase block">
                ANALYTICS ENGINE
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans uppercase">
                Detection Intelligence
              </h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-[#d8d8d8] border border-white/15">
              ON-DEVICE
            </span>
          </div>

          {/* Selected Frame Metadata Block */}
          {selectedImage && (
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#9a9a9a] block">
                  SELECTED FRAME
                </span>
                <span className="text-sm font-bold font-mono text-white mt-0.5 block">
                  FRAME {String(selectedImage.frameNumber).padStart(2, '0')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-[#9a9a9a] block">TIMESTAMP</span>
                <span className="text-[11px] font-mono text-[#d8d8d8]">{selectedImage.timestamp}</span>
              </div>
            </div>
          )}

          {/* Core Metrics: HUMANS DETECTED, CONFIDENCE, RESCUE PRIORITY, INFERENCE STATUS */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. HUMANS DETECTED */}
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.03] flex flex-col">
              <span className="text-[10px] font-mono uppercase text-[#9a9a9a] tracking-wider">
                HUMANS DETECTED
              </span>
              <div className="mt-1">
                {isAnalyzed ? (
                  <span className="text-2xl font-bold font-sans text-white">
                    {humansDetectedCount}
                  </span>
                ) : (
                  <span className="text-xs font-mono text-[#9a9a9a]">
                    AWAITING
                  </span>
                )}
              </div>
            </div>

            {/* 2. CONFIDENCE */}
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.03] flex flex-col">
              <span className="text-[10px] font-mono uppercase text-[#9a9a9a] tracking-wider">
                CONFIDENCE
              </span>
              <div className="mt-1">
                {maxConfidence !== null ? (
                  <span className="text-2xl font-bold font-sans text-white">
                    {maxConfidence}%
                  </span>
                ) : (
                  <span className="text-xs font-mono text-[#9a9a9a]">
                    {isAnalyzed ? '0%' : 'STANDBY'}
                  </span>
                )}
              </div>
            </div>

            {/* 3. RESCUE PRIORITY */}
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.03] flex flex-col">
              <span className="text-[10px] font-mono uppercase text-[#9a9a9a] tracking-wider">
                RESCUE PRIORITY
              </span>
              <div className="mt-1.5">
                {highestPriority ? (
                  <span
                    className={`text-xs font-bold font-mono px-2 py-0.5 rounded inline-block ${
                      highestPriority === 'CRITICAL'
                        ? 'bg-red-950 text-red-200 border border-red-500'
                        : highestPriority === 'HIGH'
                        ? 'bg-amber-950 text-amber-200 border border-amber-500'
                        : 'bg-emerald-950 text-emerald-200 border border-emerald-500'
                    }`}
                  >
                    {highestPriority}
                  </span>
                ) : (
                  <span className="text-xs font-mono text-[#9a9a9a]">
                    {isAnalyzed ? 'NONE' : 'STANDBY'}
                  </span>
                )}
              </div>
            </div>

            {/* 4. INFERENCE STATUS */}
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.03] flex flex-col">
              <span className="text-[10px] font-mono uppercase text-[#9a9a9a] tracking-wider">
                INFERENCE STATUS
              </span>
              <div className="mt-1.5">
                <span className="text-xs font-mono font-medium text-white flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isInferring
                        ? 'bg-amber-400 animate-spin'
                        : isAnalyzed
                        ? 'bg-emerald-400'
                        : 'bg-white/40'
                    }`}
                  />
                  {isInferring
                    ? 'INSPECTING'
                    : isAnalyzed
                    ? 'ANALYZED'
                    : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>

          {/* Action: Run On-Device Inference on this Frame */}
          <button
            id="btn-run-frame-inference"
            onClick={handleRunInference}
            disabled={isInferring || !selectedImage}
            className="btn-metallic-primary w-full py-2.5 text-sm metallic-shine"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>
              {isInferring
                ? 'Running On-Device CV...'
                : isAnalyzed
                ? 'Re-run On-Device Inference'
                : 'Run On-Device Inference'}
            </span>
          </button>

          {/* Detected Humans List & Inspector */}
          <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
            <span className="text-[11px] font-mono tracking-wider text-[#9a9a9a] uppercase flex items-center justify-between">
              <span>DETECTED TARGETS ({detections.length})</span>
              {detections.length > 0 && (
                <span className="text-[10px] text-amber-400 font-sans">Click to inspect</span>
              )}
            </span>

            {detections.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-white/10 text-center text-xs font-mono text-[#9a9a9a]">
                {isAnalyzed
                  ? 'NO HUMAN DETECTIONS IN THIS FRAME'
                  : 'STANDBY — RUN INFERENCE TO ANALYZE'}
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {detections.map((det, index) => {
                  const isSelected = selectedDetection?.id === det.id;
                  return (
                    <div
                      key={det.id}
                      onClick={() => setSelectedDetection(det)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-white bg-white/15'
                          : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-white uppercase">
                            TARGET #{index + 1}
                          </span>
                          <span className="text-[10px] font-mono text-[#9a9a9a]">
                            CONF: {Math.round(det.confidence * 100)}%
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                            det.priority === 'CRITICAL'
                              ? 'bg-red-950 text-red-200 border border-red-600'
                              : det.priority === 'HIGH'
                              ? 'bg-amber-950 text-amber-200 border border-amber-600'
                              : 'bg-emerald-950 text-emerald-200 border border-emerald-600'
                          }`}
                        >
                          {det.priority}
                        </span>
                      </div>

                      {det.hazardNotes && (
                        <p className="text-[11px] text-[#d8d8d8] mt-1.5 leading-snug font-sans">
                          {det.hazardNotes}
                        </p>
                      )}

                      {det.thermalSignature && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-[#9a9a9a]">
                          <Flame className="w-3 h-3 text-orange-400" />
                          <span>{det.thermalSignature}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Engine Note & Settings link */}
          <div className="pt-2 border-t border-white/10 text-center">
            <button
              onClick={() => navigate('/settings')}
              className="text-[11px] text-[#9a9a9a] hover:text-white transition-colors underline underline-offset-4 font-sans"
            >
              On-Device YOLO Tiny Architecture Specs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
