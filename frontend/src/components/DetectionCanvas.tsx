import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DroneImage, Detection } from '../types';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Crosshair,
  Download,
  Flame,
  Moon,
  Tag,
  CheckCircle2,
} from 'lucide-react';

interface DetectionCanvasProps {
  image: DroneImage | null;
  selectedDetectionId?: string | null;
  onSelectDetection?: (detection: Detection | null) => void;
}

type HudFilter = 'NORMAL' | 'THERMAL' | 'NIGHT';

export const DetectionCanvas: React.FC<DetectionCanvasProps> = ({
  image,
  selectedDetectionId,
  onSelectDetection,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showGridCoords, setShowGridCoords] = useState(true);
  const [hudFilter, setHudFilter] = useState<HudFilter>('NORMAL');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Synchronize natural image dimensions whenever active image URL changes
  useEffect(() => {
    if (!image?.url) return;

    // Reset pan when switching image
    setPan({ x: 0, y: 0 });

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

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(Number((prev + 0.25).toFixed(2)), 3.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(Number((prev - 0.25).toFixed(2)), 0.75));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse wheel smooth zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom((prev) => Math.min(3.5, Math.max(0.75, Number((prev + delta).toFixed(2)))));
    }
  };

  // Pan drag controls
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsPanning(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
  };

  // Cycle HUD filter: NORMAL -> THERMAL -> NIGHT -> NORMAL
  const cycleHudFilter = () => {
    setHudFilter((prev) => {
      if (prev === 'NORMAL') return 'THERMAL';
      if (prev === 'THERMAL') return 'NIGHT';
      return 'NORMAL';
    });
  };

  // Quick Download Annotated Frame
  const handleDownloadAnnotatedFrame = useCallback(async () => {
    if (!image || !imgRef.current) return;
    setIsExporting(true);

    try {
      const srcImg = new Image();
      srcImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        srcImg.onload = () => resolve();
        srcImg.onerror = (err) => reject(err);
        srcImg.src = image.url;
      });

      const nw = srcImg.naturalWidth || 1920;
      const nh = srcImg.naturalHeight || 1080;

      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Apply tactical filter if enabled
      if (hudFilter === 'THERMAL') {
        ctx.filter = 'contrast(1.7) brightness(0.9) saturate(2.4) hue-rotate(185deg) invert(0.85)';
      } else if (hudFilter === 'NIGHT') {
        ctx.filter = 'contrast(1.6) brightness(1.15) sepia(1) hue-rotate(75deg) saturate(3)';
      }

      ctx.drawImage(srcImg, 0, 0, nw, nh);
      ctx.filter = 'none'; // reset filter for annotations

      // Draw Grid Coordinate Overlay if enabled
      if (showGridCoords) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        const cols = 4;
        const rows = 4;
        const cellW = nw / cols;
        const cellH = nh / rows;

        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';

        for (let c = 0; c <= cols; c++) {
          ctx.beginPath();
          ctx.moveTo(c * cellW, 0);
          ctx.lineTo(c * cellW, nh);
          ctx.stroke();
        }
        for (let r = 0; r <= rows; r++) {
          ctx.beginPath();
          ctx.moveTo(0, r * cellH);
          ctx.lineTo(nw, r * cellH);
          ctx.stroke();
        }

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const label = `${String.fromCharCode(65 + r)}${c + 1}`;
            ctx.fillText(label, c * cellW + 8, r * cellH + 20);
          }
        }
      }

      // Draw bounding boxes and confidence labels if enabled
      if (showBoxes && image.detections) {
        image.detections.forEach((det, idx) => {
          const confidence = typeof det.confidence === 'number' ? det.confidence : 0.85;
          const priority =
            det.priority || (confidence >= 0.82 ? 'CRITICAL' : confidence >= 0.7 ? 'HIGH' : 'MEDIUM');

          const color =
            priority === 'CRITICAL' ? '#ef4444' : priority === 'HIGH' ? '#f59e0b' : '#10b981';

          let x1 = 0;
          let y1 = 0;
          let x2 = 0;
          let y2 = 0;

          if (det.box && det.box.length >= 4) {
            x1 = det.box[0];
            y1 = det.box[1];
            x2 = det.box[2];
            y2 = det.box[3];
          } else {
            x1 = det.x * nw;
            y1 = det.y * nh;
            x2 = (det.x + det.width) * nw;
            y2 = (det.y + det.height) * nh;
          }

          const boxX = Math.min(x1, x2);
          const boxY = Math.min(y1, y2);
          const boxW = Math.max(10, Math.abs(x2 - x1));
          const boxH = Math.max(10, Math.abs(y2 - y1));

          // Draw Bounding Box
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(2, Math.round(nw / 600));
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          // Draw corner markers
          const cornerLen = Math.min(12, boxW / 3, boxH / 3);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          // top-left
          ctx.beginPath();
          ctx.moveTo(boxX, boxY + cornerLen);
          ctx.lineTo(boxX, boxY);
          ctx.lineTo(boxX + cornerLen, boxY);
          ctx.stroke();
          // top-right
          ctx.beginPath();
          ctx.moveTo(boxX + boxW - cornerLen, boxY);
          ctx.lineTo(boxX + boxW, boxY);
          ctx.lineTo(boxX + boxW, boxY + cornerLen);
          ctx.stroke();

          // Draw confidence label badge if enabled
          if (showLabels) {
            const labelText = `HUMAN ${Math.round(confidence * 100)}% [${priority}]`;
            ctx.font = 'bold 12px "JetBrains Mono", monospace';
            const textWidth = ctx.measureText(labelText).width;
            const badgeH = 20;
            const badgeW = textWidth + 12;
            const badgeY = boxY > 24 ? boxY - badgeH - 2 : boxY + boxH + 2;

            ctx.fillStyle =
              priority === 'CRITICAL'
                ? 'rgba(127, 29, 29, 0.95)'
                : priority === 'HIGH'
                ? 'rgba(120, 53, 15, 0.95)'
                : 'rgba(6, 78, 59, 0.95)';
            ctx.fillRect(boxX, badgeY, badgeW, badgeH);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX, badgeY, badgeW, badgeH);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(labelText, boxX + 6, badgeY + 14);
          }
        });
      }

      // Draw Tactical Telemetry Header & Footer Banners
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, nw, 36);
      ctx.fillRect(0, nh - 32, nw, 32);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      const padNum = String(image.frameNumber).padStart(2, '0');
      ctx.fillText(`RESCUE-EYE // DRONE-07 // FRAME-${padNum} // ${image.filename}`, 16, 22);

      const alt = image.altitudeMeters || 60;
      const hdg = image.compassHeading ?? image.heading ?? 0;
      ctx.fillStyle = '#d8d8d8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(`ALT: ${alt}M | HDG: ${hdg}° | SECTOR: ${image.sector} | COORDS: ${image.gpsCoords.lat.toFixed(4)}N, ${image.gpsCoords.lng.toFixed(4)}W`, 16, nh - 12);
      ctx.fillText(`${new Date().toISOString()} // ON-DEVICE TFLITE PRODUCTION`, nw - 420, 22);

      // Trigger instant PNG download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `RESCUE_FRAME_${padNum}_ANNOTATED.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export annotated frame:', err);
    } finally {
      setIsExporting(false);
    }
  }, [image, hudFilter, showBoxes, showLabels, showGridCoords]);

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
          or load the VisDrone mission pack.
        </p>
      </div>
    );
  }

  const detections = image.detections || [];
  const hasDetections = detections.length > 0;

  // Compute CSS filter string
  const filterStyle =
    hudFilter === 'THERMAL'
      ? 'contrast(1.7) brightness(0.9) saturate(2.4) hue-rotate(185deg) invert(0.85)'
      : hudFilter === 'NIGHT'
      ? 'contrast(1.6) brightness(1.15) sepia(1) hue-rotate(75deg) saturate(3)'
      : 'none';

  return (
    <div
      id="detection-viewer-container"
      className="relative w-full h-full min-h-[500px] lg:min-h-[620px] flex flex-col rounded-xl border border-white/15 bg-black overflow-hidden shadow-2xl"
    >
      {/* Top HUD Telemetry & Tactical Controls Bar */}
      <div className="w-full px-3 sm:px-4 py-2 bg-black/90 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center justify-between gap-2 z-20 text-xs font-mono">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-white font-bold tracking-wide">
            FRAME {String(image.frameNumber).padStart(2, '0')}
          </span>
          <span className="text-[#9a9a9a] truncate max-w-[120px] sm:max-w-[200px]">
            {image.filename}
          </span>
          <span className="hidden md:inline text-white/30">•</span>
          <span className="hidden md:inline text-[#d8d8d8]">
            ALT {image.altitudeMeters}M
          </span>
          <span className="hidden md:inline text-white/30">•</span>
          <span className="hidden md:inline text-[#d8d8d8]">
            HDG {image.compassHeading ?? image.heading ?? 0}°
          </span>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Zoom controls with Pan Reset */}
          <div className="flex items-center border border-white/15 rounded-md bg-white/5 p-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1 text-[#9a9a9a] hover:text-white transition-colors"
              title="Zoom out (Mouse wheel down)"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] text-white font-mono min-w-[36px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-[#9a9a9a] hover:text-white transition-colors"
              title="Zoom in (Mouse wheel up)"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 text-[#9a9a9a] hover:text-white transition-colors border-l border-white/10 ml-0.5"
              title="Reset zoom and pan"
              aria-label="Reset zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* HUD Filter Switch: NORMAL / THERMAL / NIGHT */}
          <button
            id="btn-hud-filter"
            onClick={cycleHudFilter}
            className={`px-2 py-1 rounded-md text-xs font-sans transition-colors flex items-center gap-1.5 border ${
              hudFilter === 'THERMAL'
                ? 'bg-orange-950/80 text-orange-200 border-orange-500/80'
                : hudFilter === 'NIGHT'
                ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/80'
                : 'bg-white/5 text-[#9a9a9a] border-white/10 hover:text-white'
            }`}
            title="Toggle HUD Sensor Filter (Normal / Thermal FLIR / Night Vision)"
          >
            {hudFilter === 'THERMAL' ? (
              <Flame className="w-3.5 h-3.5 text-orange-400" />
            ) : hudFilter === 'NIGHT' ? (
              <Moon className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {hudFilter === 'THERMAL' ? 'Thermal' : hudFilter === 'NIGHT' ? 'Night NVG' : 'Sensor'}
            </span>
          </button>

          {/* Toggle Bounding Boxes */}
          <button
            onClick={() => setShowBoxes(!showBoxes)}
            className={`px-2 py-1 rounded-md text-xs font-sans transition-colors flex items-center gap-1.5 border ${
              showBoxes
                ? 'bg-white/15 text-white border-white/40'
                : 'bg-white/5 text-[#9a9a9a] border-white/10 hover:text-white'
            }`}
            title="Toggle Bounding Boxes"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Boxes</span>
          </button>

          {/* Toggle Confidence Labels */}
          {showBoxes && (
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`px-2 py-1 rounded-md text-xs font-sans transition-colors flex items-center gap-1.5 border ${
                showLabels
                  ? 'bg-white/15 text-white border-white/40'
                  : 'bg-white/5 text-[#9a9a9a] border-white/10 hover:text-white'
              }`}
              title="Toggle Confidence Badges"
            >
              <Tag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Labels</span>
            </button>
          )}

          {/* Toggle Coordinate Grid */}
          <button
            onClick={() => setShowGridCoords(!showGridCoords)}
            className={`px-2 py-1 rounded-md text-xs font-sans transition-colors flex items-center gap-1.5 border ${
              showGridCoords
                ? 'bg-white/15 text-white border-white/40'
                : 'bg-white/5 text-[#9a9a9a] border-white/10 hover:text-white'
            }`}
            title="Toggle Tactical Coordinate Overlay Grid"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>

          {/* Quick Download Annotated Frame Button */}
          <button
            id="btn-download-annotated-frame"
            onClick={handleDownloadAnnotatedFrame}
            disabled={isExporting}
            className={`px-2.5 py-1 rounded-md text-xs font-sans transition-colors flex items-center gap-1.5 border ${
              downloadSuccess
                ? 'bg-emerald-950 text-emerald-200 border-emerald-500'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/25 hover:border-white/50'
            }`}
            title="Download Annotated High-Res Frame with Bounding Boxes & HUD Telemetry"
          >
            {downloadSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {downloadSuccess ? 'Downloaded' : 'Export Frame'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Viewport Workspace with Smooth Zoom & Drag-to-Pan */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className={`relative flex-1 w-full bg-[#040404] overflow-hidden flex items-center justify-center p-2 sm:p-4 select-none ${
          zoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
      >
        <div
          className="relative inline-block max-w-full transition-transform duration-75 ease-out origin-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Drone Image Render with HUD sensor filter */}
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
            style={{ filter: filterStyle }}
            className="w-full max-w-[1020px] h-auto object-contain rounded-lg border border-white/10 shadow-2xl block pointer-events-none transition-[filter] duration-200"
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
                const confidence = typeof det.confidence === 'number' ? det.confidence : 0.85;
                const priority =
                  det.priority ||
                  (confidence >= 0.82 ? 'CRITICAL' : confidence >= 0.70 ? 'HIGH' : 'MEDIUM');
                const isCritical = priority === 'CRITICAL';
                const isHigh = priority === 'HIGH';

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
                  xmin = dx;
                  ymin = dy;
                  xmax = dx + dw;
                  ymax = dy + dh;
                  isAbsolute = dx > 1.0 || dy > 1.0 || dw > 1.0 || dh > 1.0;
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

                leftPct = Math.max(0, Math.min(100, leftPct));
                topPct = Math.max(0, Math.min(100, topPct));
                widthPct = Math.max(0.5, Math.min(100 - leftPct, widthPct));
                heightPct = Math.max(0.5, Math.min(100 - topPct, heightPct));

                const isNearTop = topPct < 5;

                return (
                  <div
                    key={detId}
                    id={`bounding-box-${detId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDetection && onSelectDetection(det);
                    }}
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
                    {/* Bounding Box Border */}
                    <div
                      className={`relative w-full h-full border-2 ${
                        isSelected ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'
                      }`}
                      style={{ borderColor }}
                    >
                      {/* Corner cross-markers */}
                      <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white pointer-events-none" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white pointer-events-none" />
                      <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white pointer-events-none" />
                      <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white pointer-events-none" />

                      {/* Toggleable Identification Badge */}
                      {showLabels && (
                        <div
                          className={`absolute ${
                            isNearTop ? 'top-full mt-1' : '-top-6'
                          } left-0 flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold border ${badgeBg} shadow-lg whitespace-nowrap z-30 pointer-events-none`}
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
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tactical Military Grid Coordinate Overlay */}
          {showGridCoords && (
            <div className="absolute inset-0 pointer-events-none border border-white/10 overflow-hidden">
              <div className="grid grid-cols-4 grid-rows-4 w-full h-full">
                {['A', 'B', 'C', 'D'].map((rowLetter, rIdx) =>
                  [1, 2, 3, 4].map((colNum, cIdx) => (
                    <div
                      key={`${rowLetter}${colNum}`}
                      className="border border-white/[0.08] relative p-1.5 flex items-start justify-start"
                    >
                      <span className="text-[9px] font-mono font-semibold text-white/30 tracking-widest">
                        {rowLetter}{colNum}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {/* Central crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 border border-white/30 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white/40" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notice Banner: Indicates On-Device Production Inference */}
      <div className="w-full px-3 sm:px-4 py-2 bg-black/95 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 z-20">
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
              {image.gpsCoords.lat.toFixed(4)}°N, {image.gpsCoords.lng.toFixed(4)}°W
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
