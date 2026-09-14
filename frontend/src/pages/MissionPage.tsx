import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Layers,
  Cpu,
  MapPin,
  FileCheck,
  Play,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useMission } from '../state/MissionContext';

export const MissionPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const {
    images,
    missionMetadata,
    importImages,
    load100FrameMissionPack,
    clearMission,
    isProcessingQueue,
    isBackendConnected,
  } = useMission();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const count = await importImages(e.target.files);
    setUploadFeedback(`Imported ${count} local drone frame${count > 1 ? 's' : ''} to on-device queue.`);
    setTimeout(() => setUploadFeedback(null), 4000);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const count = await importImages(e.dataTransfer.files);
      setUploadFeedback(`Imported ${count} local drone frame${count > 1 ? 's' : ''} to on-device queue.`);
      setTimeout(() => setUploadFeedback(null), 4000);
    }
  };

  return (
    <div id="mission-page" className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col gap-6">
      {/* Header & Mission Metadata Area */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono tracking-widest text-[#9a9a9a] uppercase">
                EMERGENCY RESPONSE DIRECTIVE
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${
                  isBackendConnected
                    ? 'bg-emerald-950/60 text-emerald-200 border border-emerald-500/40'
                    : 'bg-amber-950/60 text-amber-200 border border-amber-500/40'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isBackendConnected
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                {isBackendConnected
                  ? 'ON-DEVICE TFLITE PRODUCTION'
                  : 'ON-DEVICE (DEMO ADAPTER)'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase font-sans">
              Search & Rescue Mission
            </h1>
          </div>

          {/* Quick Action Navigation if images loaded */}
          {images.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                id="btn-goto-queue"
                onClick={() => navigate('/queue')}
                className="btn-metallic-ghost px-3.5 py-2 text-xs font-sans"
              >
                <span>View Queue ({images.length})</span>
              </button>
              <button
                id="btn-goto-detection"
                onClick={() => navigate('/detection')}
                className="btn-metallic-primary px-4 py-2 text-xs font-sans"
              >
                <span>Detection Station</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Mission Metadata Bar with clean Inter labels and technical monospace values */}
        <div
          id="mission-metadata-bar"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-3.5 rounded-lg border border-white/10 bg-black/50 backdrop-blur-md"
        >
          {/* 1. MISSION */}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-wider text-[#9a9a9a] uppercase">
              MISSION ID
            </span>
            <span className="text-sm font-semibold text-white mt-0.5 font-mono">
              {missionMetadata.missionId}
            </span>
          </div>

          {/* 2. LOCATION */}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-wider text-[#9a9a9a] uppercase">
              LOCATION
            </span>
            <span className="text-sm font-medium text-white mt-0.5 truncate font-sans" title={missionMetadata.location}>
              {missionMetadata.location}
            </span>
          </div>

          {/* 3. IMAGE SET */}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-wider text-[#9a9a9a] uppercase">
              IMAGE SET
            </span>
            <span className="text-sm font-semibold text-white mt-0.5 font-mono">
              {images.length} / 100 IMAGES
            </span>
          </div>

          {/* 4. MODEL TARGET */}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-wider text-[#9a9a9a] uppercase">
              MODEL TARGET
            </span>
            <span className="text-sm font-medium text-white mt-0.5 font-sans">
              YOLO Tiny (FP16)
            </span>
          </div>

          {/* 5. TARGET RUNTIME */}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-wider text-[#9a9a9a] uppercase">
              TARGET RUNTIME
            </span>
            <span className="text-sm font-medium text-[#d8d8d8] mt-0.5 font-sans">
              TensorFlow Lite
            </span>
          </div>

          {/* 6. EXECUTION */}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-wider text-[#9a9a9a] uppercase">
              EXECUTION ADAPTER
            </span>
            <span
              className={`text-sm font-medium mt-0.5 flex items-center gap-1.5 font-sans ${
                isBackendConnected ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isBackendConnected
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              {isBackendConnected
                ? 'On-Device TFLite Production'
                : 'On-Device (Demo)'}
            </span>
          </div>
        </div>
      </div>

      {/* Upload Feedback Toast */}
      {uploadFeedback && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{uploadFeedback}</span>
        </div>
      )}

      {/* DOMINANT DRONE UPLOAD WORKSPACE per Section 4 & 5 */}
      <div
        id="upload-workspace"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-8 sm:p-16 rounded-xl border border-white/20 transition-all duration-300 min-h-[400px] text-center technical-grid ${
          isDragging
            ? 'border-white bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.15)]'
            : 'bg-gradient-to-b from-white/[0.04] to-black/80 hover:border-white/35 shadow-xl'
        }`}
      >
        {/* Understated technical corner bracket accents */}
        <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t border-l border-white/50 pointer-events-none" />
        <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t border-r border-white/50 pointer-events-none" />
        <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b border-l border-white/50 pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b border-r border-white/50 pointer-events-none" />

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          id="file-upload-input"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Center Icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mb-5 shadow-inner text-white group-hover:scale-105 transition-transform">
          <Upload className="w-8 h-8 sm:w-9 sm:h-9 text-white opacity-90" />
        </div>

        {/* Main Text in clean Inter display typography */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase font-sans mb-2">
          Ready for Drone Imagery
        </h2>

        {/* Secondary Text */}
        <p className="text-sm sm:text-base text-[#9a9a9a] max-w-md mx-auto mb-6 font-sans">
          Upload up to 100 drone frames for on-device analysis.
        </p>

        {/* Current Count Display */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-white mb-8">
          <span className="text-[#9a9a9a] font-mono text-[11px] uppercase">MISSION FRAMES:</span>
          <strong className="text-white text-xs font-mono">
            {images.length} / 100 IMAGES
          </strong>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-2xl justify-center">
          <button
            id="btn-import-drone-images"
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= 100}
            className="btn-metallic-primary w-full sm:w-auto px-7 py-3.5 text-sm metallic-shine flex items-center justify-center gap-2.5 font-sans font-semibold tracking-wide"
          >
            <Upload className="w-4 h-4" />
            <span>IMPORT DRONE IMAGES</span>
          </button>

          <button
            id="btn-load-mission-pack"
            onClick={() => load100FrameMissionPack(20)}
            className="btn-metallic-ghost w-full sm:w-auto px-7 py-3.5 text-sm metallic-shine flex items-center justify-center gap-2.5 font-sans font-semibold tracking-wide border-white/30 hover:border-white/60 text-white"
          >
            <Layers className="w-4 h-4 text-white" />
            <span>LOAD MISSION PACK (VISDRONE)</span>
          </button>
        </div>

        {/* Supported formats & On-Device Security Note */}
        <p className="text-[11px] font-mono text-[#9a9a9a] mt-6 tracking-wide">
          ACCEPTED: JPG • JPEG • PNG • WEBP — ALL PREPROCESSING & INFERENCE OCCURS ON-DEVICE
        </p>

        {/* Clear Mission option if images loaded */}
        {images.length > 0 && (
          <button
            id="btn-clear-mission"
            onClick={clearMission}
            className="mt-4 text-xs font-mono text-white/50 hover:text-red-400 flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Mission & Clear Images ({images.length})</span>
          </button>
        )}
      </div>

      {/* RESTRAINED TECHNICAL INFORMATION STRIP (Supports rather than competes per Section 4) */}
      <div className="border-t border-white/10 pt-4 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 divide-y md:divide-y-0 md:divide-x divide-white/10">
          <div className="pt-2 md:pt-0 md:pr-4 flex flex-col gap-1">
            <span className="text-[10px] font-mono text-[#9a9a9a] uppercase tracking-wider">
              01 / DRONE INGEST
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">
              Direct Frame Ingestion
            </h3>
            <p className="text-xs text-[#9a9a9a] leading-relaxed font-sans">
              Drone imagery is held in local memory buffers. No frames are transmitted to external servers or cloud vision endpoints.
            </p>
          </div>

          <div className="pt-4 md:pt-0 md:px-6 flex flex-col gap-1">
            <span className="text-[10px] font-mono text-[#9a9a9a] uppercase tracking-wider">
              02 / COMPUTER VISION
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">
              YOLO Tiny On-Device
            </h3>
            <p className="text-xs text-[#9a9a9a] leading-relaxed font-sans">
              Quantized INT8 inference operates directly on client canvas pixels to locate human survivor candidates in flood/debris terrain.
            </p>
          </div>

          <div className="pt-4 md:pt-0 md:pl-6 flex flex-col gap-1">
            <span className="text-[10px] font-mono text-[#9a9a9a] uppercase tracking-wider">
              03 / RESCUE TRIAGE
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">
              Priority Classification
            </h3>
            <p className="text-xs text-[#9a9a9a] leading-relaxed font-sans">
              Detections are automatically prioritized (CRITICAL, HIGH, MEDIUM) to direct airlift and rescue boat teams to life-threatening zones first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
