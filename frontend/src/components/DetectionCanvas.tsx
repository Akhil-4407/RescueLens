import React, { useState, useRef } from 'react';
import { DroneImage, Detection } from '../types';
import { ZoomIn, ZoomOut, RotateCcw, Eye, Crosshair, AlertTriangle } from 'lucide-react';

interface DetectionCanvasProps {
  image: DroneImage | null;
  selectedDetectionId?: string | null;
  onSelectDetection?: (detection: Detection | null) => void;
}

export const DetectionCanvas: React.FC<DetectionCanvasProps> = ({
  image,
  selectedDetectionId,
  onSelectDetection,
}) => {
  const [zoom, setZoom] = useState(1);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showCrosshairs, setShowCrosshairs] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoom(1);

  if (!image) {
    return (
      <div
        id="detection-canvas-empty"
        className="w-full h-full min-h-[420px] flex flex-col items-center justify-center p-8 rounded-lg border border-dashed border-white/20 bg-black/60 text-center"
      >
        <div className="w-16 h-16 mb-4 rounded-full border border-white/20 flex items-center justify-center text-[#9a9a9a]">
          <Crosshair className="w-8 h-8 opacity-60" />
        </div>
        <h3 className="text-lg font-medium text-white font-mono tracking-wide">
          AWAITING FRAME
        </h3>
        <p className="text-sm text-[#9a9a9a] max-w-sm mt-1">
          No drone imagery currently selected. Select a frame from the Image Queue
          or import frames on the Mission page.
        </p>
      </div>
    );
  }

  const detections = image.detections || [];
  const hasDetections = detections.length > 0;

  return (
    <div
      id="detection-viewer-container"
      className="relative w-full h-full min-h-[500px] lg:min-h-[620px] flex flex-col rounded-xl border border-white/15 bg-black overflow-hidden shadow-2xl"
    >
      {/* Top HUD Telemetry Bar */}
      <div className="w-full px-4 py-2.5 bg-black/85 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-20 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold tracking-wide">
            FRAME {String(image.frameNumber).padStart(2, '0')}
          </span>
          <span className="text-[#9a9a9a] truncate max-w-[130px] sm:max-w-[240px]">
            {image.filename}
          </span>
          <span className="hidden md:inline text-white/30">•</span>
          <span className="hidden md:inline text-[#d8d8d8]">
            ALT {image.altitudeMeters}M
          </span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom controls */}
          <div className="flex items-center border border-white/15 rounded-md bg-white/5 p-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1 text-[#9a9a9a] hover:text-white transition-colors"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] text-white font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-[#9a9a9a] hover:text-white transition-colors"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 text-[#9a9a9a] hover:text-white transition-colors border-l border-white/10 ml-0.5"
              title="Reset zoom"
              aria-label="Reset zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Toggle Bounding Boxes */}
          <button
            onClick={() => setShowBoxes(!showBoxes)}
            className={`px-2.5 py-1 rounded-md text-xs font-sans transition-colors flex items-center gap-1.5 border ${
              showBoxes
                ? 'bg-white/15 text-white border-white/40'
                : 'bg-white/5 text-[#9a9a9a] border-white/10 hover:text-white'
            }`}
            title="Toggle Bounding Boxes"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Boxes</span>
          </button>

          {/* Toggle Reticle */}
          <button
            onClick={() => setShowCrosshairs(!showCrosshairs)}
            className={`px-2.5 py-1 rounded-md text-xs font-sans transition-colors flex items-center gap-1.5 border ${
              showCrosshairs
                ? 'bg-white/15 text-white border-white/40'
                : 'bg-white/5 text-[#9a9a9a] border-white/10 hover:text-white'
            }`}
            title="Toggle Drone Reticle Overlay"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Workspace with Zoom */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full bg-[#040404] overflow-auto flex items-center justify-center p-3 sm:p-5 select-none"
      >
        <div
          className="relative max-w-full transition-transform duration-200 ease-out origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Drone Image Render */}
          <img
            id="active-drone-image"
            src={image.url}
            alt={`Drone Frame ${image.frameNumber}`}
            className="w-full max-w-[1020px] h-auto object-contain rounded-lg border border-white/10 shadow-2xl block pointer-events-none"
          />

          {/* Computer Vision Bounding Box Overlay Layer */}
          {showBoxes && (
            <div
              id="bounding-box-overlay-layer"
              className="absolute inset-0 pointer-events-auto"
            >
              {detections.map((det) => {
                const isSelected = selectedDetectionId === det.id;
                const isCritical = det.priority === 'CRITICAL';
                const isHigh = det.priority === 'HIGH';

                // Semantic styling for search & rescue bounding boxes: elegant, high contrast, clear
                const borderColor = isCritical
                  ? '#ef4444'
                  : isHigh
                  ? '#f59e0b'
                  : '#10b981';

                const badgeBg = isCritical
                  ? 'bg-red-950/95 text-red-100 border-red-500/80 shadow-red-950/50'
                  : isHigh
                  ? 'bg-amber-950/95 text-amber-100 border-amber-500/80 shadow-amber-950/50'
                  : 'bg-emerald-950/95 text-emerald-100 border-emerald-500/80 shadow-emerald-950/50';

                return (
                  <div
                    key={det.id}
                    id={`bounding-box-${det.id}`}
                    onClick={() => onSelectDetection && onSelectDetection(det)}
                    className={`absolute cursor-pointer transition-all duration-150 ${
                      isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black z-30' : 'z-20'
                    }`}
                    style={{
                      left: `${det.x * 100}%`,
                      top: `${det.y * 100}%`,
                      width: `${det.width * 100}%`,
                      height: `${det.height * 100}%`,
                    }}
                  >
                    {/* Bounding Box Border with precision technical styling */}
                    <div
                      className={`relative w-full h-full border-2 ${
                        isSelected ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'
                      }`}
                      style={{ borderColor }}
                    >
                      {/* Corner technical cross-markers for precise alignment */}
                      <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white pointer-events-none" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white pointer-events-none" />
                      <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white pointer-events-none" />
                      <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white pointer-events-none" />

                      {/* Top Unified Identification Badge: Elegant, readable, non-cluttering */}
                      <div
                        className={`absolute -top-6 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold border ${badgeBg} shadow-lg whitespace-nowrap`}
                      >
                        <span className="uppercase text-white font-bold">HUMAN</span>
                        <span className="text-white/80 font-mono">
                          {Math.round(det.confidence * 100)}%
                        </span>
                        <span className="opacity-40">•</span>
                        <span className="font-bold">{det.priority}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Technical HUD Overlay Grid lines when enabled */}
          {showCrosshairs && (
            <div className="absolute inset-0 pointer-events-none border border-white/5">
              <div className="absolute inset-0 technical-grid opacity-15" />
            </div>
          )}
        </div>
      </div>

      {/* Notice Banner: Clearly indicates On-Device Simulated Detection */}
      <div className="w-full px-4 py-2 bg-black/95 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] font-mono text-white">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            ON-DEVICE DEMO INFERENCE
          </span>
          <span className="text-[11px] text-[#9a9a9a] hidden sm:inline font-sans">
            Client-side mock engine active. TensorFlow Lite INT8 pipeline linked for production hardware.
          </span>
        </div>

        <div className="text-[11px] font-mono text-[#d8d8d8] flex items-center gap-3">
          <span>
            TARGETS:{' '}
            <strong className="text-white">
              {hasDetections ? detections.length : '0'}
            </strong>
          </span>
          <span>
            SECTOR: <span className="text-white">{image.sector}</span>
          </span>
          <span className="hidden sm:inline">
            COORDS:{' '}
            <span className="text-[#9a9a9a]">
              {image.gpsCoords.lat.toFixed(4)}N, {image.gpsCoords.lng.toFixed(4)}W
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
