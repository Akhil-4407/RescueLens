import React, { useState, useRef, useEffect } from 'react';
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
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Synchronize natural image dimensions whenever active image URL changes
  useEffect(() => {
    if (!image?.url) return;

    const syncDimensions = (w: number, h: number) => {
      if (w > 0 && h > 0) {
        setNaturalDimensions((prev) => {
          if (prev.width === w && prev.height === h) return prev;
          return { width: w, height: h };
        });
      }
    };

    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      syncDimensions(imgRef.current.naturalWidth, imgRef.current.naturalHeight);
    }

    const preloader = new Image();
    preloader.onload = () => {
      syncDimensions(preloader.naturalWidth, preloader.naturalHeight);
    };
    preloader.src = image.url;
  }, [image?.url]);

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
          className="relative inline-block max-w-full transition-transform duration-200 ease-out origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Drone Image Render */}
          <img
            ref={imgRef}
            id="active-drone-image"
            src={image.url}
            alt={`Drone Frame ${image.frameNumber}`}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth && el.naturalHeight) {
                setNaturalDimensions({ width: el.naturalWidth, height: el.naturalHeight });
              }
            }}
            className="w-full max-w-[1020px] h-auto object-contain rounded-lg border border-white/10 shadow-2xl block pointer-events-none"
          />

          {/* Computer Vision Bounding Box Overlay Layer */}
          {showBoxes && (
            <div
              id="bounding-box-overlay-layer"
              className="absolute inset-0 pointer-events-auto"
            >
              {detections.map((det, index) => {
                const detId = det.id || `det-${image.frameNumber || 1}-${index + 1}`;
                const isSelected = selectedDetectionId === detId || selectedDetectionId === det.id;
                const confidence = typeof det.confidence === 'number' ? det.confidence : 0.9;
                const priority =
                  det.priority ||
                  (confidence >= 0.92 ? 'CRITICAL' : confidence >= 0.85 ? 'HIGH' : 'MEDIUM');
                const isCritical = priority === 'CRITICAL';
                const isHigh = priority === 'HIGH';

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

                // Robust coordinate parsing: maps absolute pixel coordinates against naturalDimensions
                const imgW =
                  naturalDimensions.width > 0
                    ? naturalDimensions.width
                    : imgRef.current?.naturalWidth || 1920;
                const imgH =
                  naturalDimensions.height > 0
                    ? naturalDimensions.height
                    : imgRef.current?.naturalHeight || 1080;

                const rawBox = det.box || det.bbox;
                let xmin = 0;
                let ymin = 0;
                let xmax = 0;
                let ymax = 0;
                let isAbsolute = false;

                if (rawBox && Array.isArray(rawBox) && rawBox.length >= 4) {
                  const b0 = Number(rawBox[0]) || 0;
                  const b1 = Number(rawBox[1]) || 0;
                  const b2 = Number(rawBox[2]) || 0;
                  const b3 = Number(rawBox[3]) || 0;
                  xmin = Math.min(b0, b2);
                  ymin = Math.min(b1, b3);
                  xmax = Math.max(b0, b2);
                  ymax = Math.max(b1, b3);
                  isAbsolute = xmax > 1.0 || ymax > 1.0;
                } else if ((det as any).xmin !== undefined && (det as any).xmax !== undefined) {
                  const b0 = Number((det as any).xmin) || 0;
                  const b1 = Number((det as any).ymin) || 0;
                  const b2 = Number((det as any).xmax) || 0;
                  const b3 = Number((det as any).ymax) || 0;
                  xmin = Math.min(b0, b2);
                  ymin = Math.min(b1, b3);
                  xmax = Math.max(b0, b2);
                  ymax = Math.max(b1, b3);
                  isAbsolute = xmax > 1.0 || ymax > 1.0;
                } else {
                  const dx = Number(det.x) || 0;
                  const dy = Number(det.y) || 0;
                  const dw = Number(det.width) || 0;
                  const dh = Number(det.height) || 0;
                  if (dx > 1.0 || dy > 1.0 || dw > 1.0 || dh > 1.0) {
                    xmin = dx;
                    ymin = dy;
                    xmax = dx + dw;
                    ymax = dy + dh;
                    isAbsolute = true;
                  } else {
                    xmin = dx;
                    ymin = dy;
                    xmax = dx + dw;
                    ymax = dy + dh;
                    isAbsolute = false;
                  }
                }

                let leftPct: number;
                let topPct: number;
                let widthPct: number;
                let heightPct: number;

                if (isAbsolute) {
                  leftPct = (xmin / imgW) * 100;
                  topPct = (ymin / imgH) * 100;
                  widthPct = (Math.max(1, xmax - xmin) / imgW) * 100;
                  heightPct = (Math.max(1, ymax - ymin) / imgH) * 100;
                } else {
                  leftPct = xmin * 100;
                  topPct = ymin * 100;
                  widthPct = Math.max(0.1, xmax - xmin) * 100;
                  heightPct = Math.max(0.1, ymax - ymin) * 100;
                }

                // Clamp percentages safely within visible bounds
                leftPct = Math.max(0, Math.min(100, leftPct));
                topPct = Math.max(0, Math.min(100, topPct));
                widthPct = Math.max(0.5, Math.min(100 - leftPct, widthPct));
                heightPct = Math.max(0.5, Math.min(100 - topPct, heightPct));

                const isNearTop = topPct < 5;

                return (
                  <div
                    key={detId}
                    id={`bounding-box-${detId}`}
                    onClick={() => onSelectDetection && onSelectDetection(det)}
                    className={`absolute cursor-pointer transition-all duration-150 ${
                      isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black z-30' : 'z-20'
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
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
                        className={`absolute ${
                          isNearTop ? 'top-full mt-1' : '-top-6'
                        } left-0 flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold border ${badgeBg} shadow-lg whitespace-nowrap z-30`}
                      >
                        <span className="uppercase text-white font-bold">
                          {det.label || det.class || 'HUMAN'}
                        </span>
                        <span className="text-white/80 font-mono">
                          {Math.round(confidence * 100)}%
                        </span>
                        <span className="opacity-40">•</span>
                        <span className="font-bold">{priority}</span>
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

      {/* Notice Banner: Indicates On-Device Production Inference */}
      <div className="w-full px-4 py-2 bg-black/95 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[10px] font-mono text-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ON-DEVICE TFLITE PRODUCTION
          </span>
          <span className="text-[11px] text-[#9a9a9a] hidden sm:inline font-sans">
            TensorFlow Lite YOLO-tiny on-device inference pipeline active with high-resolution image tiling.
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
