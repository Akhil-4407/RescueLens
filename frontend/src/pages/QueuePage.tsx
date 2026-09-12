import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Square,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
  Search,
} from 'lucide-react';
import { useMission } from '../state/MissionContext';
import { FrameStatus } from '../types';

export const QueuePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    images,
    selectedImageId,
    selectImage,
    isProcessingQueue,
    processingProgress,
    currentProcessingIndex,
    runInferenceOnAll,
    stopProcessing,
    load100FrameMissionPack,
  } = useMission();

  const [filter, setFilter] = useState<'ALL' | 'HUMAN_DETECTED' | 'WAITING' | 'ANALYZED' | 'NO_HUMAN'>('ALL');

  const filteredImages = images.filter((img) => {
    if (filter === 'ALL') return true;
    if (filter === 'HUMAN_DETECTED') return img.status === 'HUMAN_DETECTED';
    if (filter === 'WAITING') return img.status === 'WAITING';
    if (filter === 'ANALYZED') return img.status === 'ANALYZED' || img.status === 'HUMAN_DETECTED' || img.status === 'NO_HUMAN';
    if (filter === 'NO_HUMAN') return img.status === 'NO_HUMAN';
    return true;
  });

  const handleSelectFrame = (id: string, navigateImmediately = false) => {
    selectImage(id);
    if (navigateImmediately) {
      navigate('/detection');
    }
  };

  const getStatusBadge = (status: FrameStatus) => {
    switch (status) {
      case 'HUMAN_DETECTED':
        return (
          <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/60">
            HUMAN DETECTED
          </span>
        );
      case 'ANALYZED':
        return (
          <span className="text-[10px] font-mono text-white/90 bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
            ANALYZED
          </span>
        );
      case 'NO_HUMAN':
        return (
          <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/50">
            NO HUMAN
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/60 animate-pulse">
            PROCESSING
          </span>
        );
      case 'ERROR':
        return (
          <span className="text-[10px] font-mono text-red-300 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-500/60">
            ERROR
          </span>
        );
      case 'WAITING':
      default:
        return (
          <span className="text-[10px] font-mono text-[#9a9a9a] bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
            WAITING
          </span>
        );
    }
  };

  if (images.length === 0) {
    return (
      <div
        id="queue-page-empty"
        className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center justify-center min-h-[60vh]"
      >
        <div className="relative p-8 sm:p-12 rounded-xl border border-white/15 bg-black/60 backdrop-blur-md technical-grid w-full">
          {/* Subtle corner framing */}
          <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t border-l border-white/40 pointer-events-none" />
          <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t border-r border-white/40 pointer-events-none" />
          <div className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b border-l border-white/40 pointer-events-none" />
          <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b border-r border-white/40 pointer-events-none" />

          <div className="w-14 h-14 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mx-auto mb-5 text-white/80">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <span className="text-[11px] font-mono tracking-widest text-[#9a9a9a] uppercase block mb-1">
            QUEUE STANDBY
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2 uppercase font-sans">
            Image Queue Empty (0 / 100)
          </h2>
          <p className="text-sm text-[#9a9a9a] max-w-md mx-auto mb-7 font-sans leading-relaxed">
            No drone frames in memory buffer. Import your drone imagery or load the 100-frame drone mission pack to run on-device pipeline inference.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              id="btn-queue-load-pack"
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

  return (
    <div id="queue-page" className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-5 flex flex-col gap-5">
      {/* Top Header & Batch Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#9a9a9a]">
            FRAME INGESTION & PIPELINE
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight font-sans">
            Drone Image Queue
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {isProcessingQueue ? (
            <button
              id="btn-stop-processing"
              onClick={stopProcessing}
              className="btn-metallic-ghost px-4 py-2 text-xs border-red-500/60 text-red-300 hover:bg-red-950/50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>STOP INFERENCE</span>
            </button>
          ) : (
            <button
              id="btn-process-all-frames"
              onClick={runInferenceOnAll}
              className="btn-metallic-primary px-5 py-2 text-xs metallic-shine"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>PROCESS ALL ({images.length} FRAMES)</span>
            </button>
          )}

          <button
            id="btn-queue-goto-detection"
            onClick={() => navigate('/detection')}
            className="btn-metallic-ghost px-4 py-2 text-xs"
          >
            <span>Inspect in Detection</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar when batch processing */}
      {isProcessingQueue && (
        <div
          id="queue-progress-bar-container"
          className="p-4 rounded-xl border border-white/20 bg-white/5 backdrop-blur-md flex flex-col gap-2"
        >
          <div className="flex items-center justify-between text-xs font-sans">
            <span className="text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-mono">
                RUNNING ON-DEVICE INFERENCE: FRAME {currentProcessingIndex} / {images.length}
              </span>
            </span>
            <span className="text-white font-mono font-bold">{processingProgress}%</span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-white via-amber-200 to-white transition-all duration-150"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter and Count Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-black/60 border border-white/10 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#9a9a9a] mr-1 flex items-center gap-1 font-mono text-[11px]">
            <Filter className="w-3.5 h-3.5" />
            FILTER:
          </span>
          {(['ALL', 'HUMAN_DETECTED', 'WAITING', 'ANALYZED', 'NO_HUMAN'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-md text-xs font-sans transition-all ${
                filter === cat
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'bg-white/5 text-[#d8d8d8] hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              {cat === 'HUMAN_DETECTED'
                ? 'Humans Detected'
                : cat === 'NO_HUMAN'
                ? 'No Humans'
                : cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="text-[#9a9a9a] font-mono text-xs">
          SHOWING <strong className="text-white">{filteredImages.length}</strong> OF{' '}
          <strong className="text-white">{images.length}</strong> FRAMES
        </div>
      </div>

      {/* Grid of Drone Frame Thumbnails (Responsive 2 to 6 columns) */}
      <div
        id="queue-grid"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
      >
        {filteredImages.map((img) => {
          const isSelected = selectedImageId === img.id;
          const padNumber = String(img.frameNumber).padStart(2, '0');
          const hasDetections = img.detections.length > 0;

          return (
            <div
              key={img.id}
              id={`frame-card-${img.frameNumber}`}
              onClick={() => handleSelectFrame(img.id)}
              onDoubleClick={() => handleSelectFrame(img.id, true)}
              className={`group relative flex flex-col rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'border-white bg-white/10 ring-2 ring-white/60 shadow-[0_0_25px_rgba(255,255,255,0.18)] scale-[1.02]'
                  : 'border-white/15 bg-black/70 hover:border-white/40 hover:bg-white/[0.04]'
              }`}
            >
              {/* Thumbnail Container */}
              <div className="relative w-full aspect-[4/3] bg-[#0c0c0c] overflow-hidden">
                <img
                  src={img.url}
                  alt={`Frame ${img.frameNumber}`}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Selected Indicator Badge */}
                {isSelected && (
                  <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-white text-black font-mono text-[9px] font-bold shadow-md">
                    ACTIVE
                  </div>
                )}

                {/* Status Overlay Badge at Bottom of Thumbnail */}
                <div className="absolute bottom-1.5 right-1.5">
                  {getStatusBadge(img.status)}
                </div>

                {/* Detections Counter if detected */}
                {hasDetections && (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-200 border border-amber-500 font-mono text-[9px] font-bold shadow">
                    {img.detections.length} DETECTED
                  </div>
                )}
              </div>

              {/* Card Meta Details */}
              <div className="p-3 flex flex-col gap-1 border-t border-white/10 bg-black/90">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white tracking-wide">
                    FRAME {padNumber}
                  </span>
                  <span className="text-[10px] font-mono text-[#9a9a9a]">
                    {img.altitudeMeters}m
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#9a9a9a] pt-0.5">
                  <span className="font-mono text-[10px] text-[#9a9a9a] truncate max-w-[85px]">{img.sector}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectFrame(img.id, true);
                    }}
                    className="text-white hover:underline text-[11px] font-sans font-medium flex items-center gap-0.5"
                    title="Open in Detection View"
                  >
                    <span>Inspect</span>
                    <span className="text-[10px]">→</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
