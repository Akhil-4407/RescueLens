import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Printer,
  Download,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useMission } from '../state/MissionContext';
import { Priority } from '../types';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { images, missionMetadata, stats, selectImage, load100FrameMissionPack } = useMission();
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | Priority>('ALL');

  // Collect all detections across processed frames
  const detectionRows = images.flatMap((img) =>
    img.detections.map((det) => ({
      frameId: img.id,
      frameNumber: img.frameNumber,
      filename: img.filename,
      sector: img.sector,
      detection: det,
    }))
  );

  const filteredDetections = detectionRows.filter((row) => {
    if (priorityFilter === 'ALL') return true;
    return row.detection.priority === priorityFilter;
  });

  const handleInspectRow = (frameId: string) => {
    selectImage(frameId);
    navigate('/detection');
  };

  const handleExportJson = () => {
    const reportData = {
      mission: missionMetadata.missionId,
      location: missionMetadata.location,
      generatedAt: new Date().toISOString(),
      stats,
      detections: detectionRows.map((r) => ({
        frameNumber: r.frameNumber,
        filename: r.filename,
        confidence: r.detection.confidence,
        priority: r.detection.priority,
        hazardNotes: r.detection.hazardNotes,
        coordinates: { x: r.detection.x, y: r.detection.y },
        simulated: r.detection.simulated,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RESCUE_EYE_MISSION_REPORT_${missionMetadata.missionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (images.length === 0) {
    return (
      <div
        id="reports-page-empty"
        className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center justify-center min-h-[60vh]"
      >
        <div className="relative p-8 sm:p-12 rounded-xl border border-white/15 bg-black/60 backdrop-blur-md technical-grid w-full">
          {/* Subtle corner framing */}
          <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t border-l border-white/40 pointer-events-none" />
          <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t border-r border-white/40 pointer-events-none" />
          <div className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b border-l border-white/40 pointer-events-none" />
          <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b border-r border-white/40 pointer-events-none" />

          <div className="w-14 h-14 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mx-auto mb-5 text-white/80">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <span className="text-[11px] font-mono tracking-widest text-[#9a9a9a] uppercase block mb-1">
            DEBRIEF LOGS EMPTY
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2 uppercase font-sans">
            No Mission Data Available
          </h2>
          <p className="text-sm text-[#9a9a9a] max-w-md mx-auto mb-7 font-sans leading-relaxed">
            Ingest drone imagery or load the 100-frame drone mission pack to generate verified incident telemetry and rescue triage reports.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              id="btn-reports-load-pack"
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
    <div id="reports-page" className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col gap-6">
      {/* Top Title & Operational Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#9a9a9a] uppercase">
              TACTICAL INCIDENT DEBRIEF
            </span>
            {stats.missionStatus === 'DEMO RESULTS' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/50">
                DEMO RESULTS
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight font-sans">
            Mission Report
          </h1>
        </div>

        {/* Print / Export Actions */}
        <div className="flex items-center gap-2.5">
          <button
            id="btn-print-report"
            onClick={() => window.print()}
            className="btn-metallic-ghost px-4 py-2 text-xs font-sans"
            title="Print Tactical Mission Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print Report</span>
          </button>

          <button
            id="btn-export-report"
            onClick={handleExportJson}
            disabled={stats.processedFrames === 0}
            className="btn-metallic-primary px-5 py-2 text-xs metallic-shine"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT TELEMETRY</span>
          </button>
        </div>
      </div>

      {/* Mission & Location Metadata Card */}
      <div className="p-4 sm:p-5 rounded-xl border border-white/15 bg-black/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 sm:gap-12">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9a9a9a] block">
              MISSION IDENTIFIER
            </span>
            <span className="text-base font-bold font-mono text-white mt-0.5 block">
              {missionMetadata.missionId}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9a9a9a] block">
              TARGET LOCATION
            </span>
            <span className="text-base font-bold font-sans text-white mt-0.5 block">
              {missionMetadata.location}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9a9a9a] block">
              EXECUTION ARCHITECTURE
            </span>
            <span className="text-xs font-mono text-emerald-400 mt-0.5 block">
              YOLO TINY / TENSORFLOW LITE (ON-DEVICE)
            </span>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[10px] font-mono text-[#9a9a9a] block">
            REPORT GENERATED
          </span>
          <span className="text-xs font-mono text-white mt-0.5 block">
            {new Date().toLocaleDateString()} — ON-DEVICE LOG
          </span>
        </div>
      </div>

      {/* SECTION 17: Four Key Mission Stats — Strictly without inventing values */}
      <div
        id="report-stats-grid"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {/* 1. FRAMES PROCESSED */}
        <div className="p-4 rounded-xl border border-white/15 bg-white/[0.03] flex flex-col">
          <span className="text-[10px] font-mono uppercase text-[#9a9a9a] tracking-wider">
            FRAMES PROCESSED
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-sans text-white">
              {stats.processedFrames}
            </span>
            <span className="text-xs font-mono text-[#9a9a9a]">
              / {stats.totalFrames}
            </span>
          </div>
          <span className="text-[11px] text-[#9a9a9a] mt-1 font-sans">
            {stats.waitingFrames > 0
              ? `${stats.waitingFrames} frames remaining`
              : 'All ingested frames analyzed'}
          </span>
        </div>

        {/* 2. HUMANS DETECTED */}
        <div className="p-4 rounded-xl border border-white/15 bg-white/[0.03] flex flex-col">
          <span className="text-[10px] font-mono uppercase text-[#9a9a9a] tracking-wider">
            HUMANS DETECTED
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-sans text-white">
              {stats.processedFrames > 0 ? stats.humansDetected : 0}
            </span>
            {stats.humansDetected > 0 && (
              <span className="text-xs font-mono text-amber-300">
                TARGETS
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#9a9a9a] mt-1 font-sans">
            {stats.averageConfidence
              ? `Avg Confidence: ${Math.round(stats.averageConfidence * 100)}%`
              : 'No detection data'}
          </span>
        </div>

        {/* 3. HIGH PRIORITY */}
        <div className="p-4 rounded-xl border border-white/15 bg-white/[0.03] flex flex-col">
          <span className="text-[10px] font-mono uppercase text-[#9a9a9a] tracking-wider">
            HIGH PRIORITY
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-sans text-white">
              {stats.processedFrames > 0 ? stats.highPriorityCount : 0}
            </span>
            {stats.criticalPriorityCount > 0 && (
              <span className="text-xs font-mono text-red-400">
                ({stats.criticalPriorityCount} CRITICAL)
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#9a9a9a] mt-1 font-sans">
            Immediate dispatch required
          </span>
        </div>

        {/* 4. MISSION STATUS */}
        <div className="p-4 rounded-xl border border-white/15 bg-white/[0.03] flex flex-col">
          <span className="text-[10px] font-mono uppercase text-[#9a9a9a] tracking-wider">
            MISSION STATUS
          </span>
          <div className="mt-2">
            <span
              className={`text-sm sm:text-base font-bold font-sans px-2.5 py-1 rounded-md inline-block ${
                stats.missionStatus === 'AWAITING DATA'
                  ? 'text-[#9a9a9a] bg-white/5 border border-white/10'
                  : stats.missionStatus === 'IN PROGRESS'
                  ? 'text-amber-300 bg-amber-950 border border-amber-500'
                  : 'text-emerald-300 bg-emerald-950 border border-emerald-500'
              }`}
            >
              {stats.missionStatus}
            </span>
          </div>
          <span className="text-[11px] text-[#9a9a9a] mt-1 font-sans">
            {stats.missionStatus === 'AWAITING DATA'
              ? 'Run inference to populate results'
              : 'Verified on client edge device'}
          </span>
        </div>
      </div>

      {/* SECTION 17: Detection Table / List */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white uppercase font-sans">
              Detection Log
            </h2>
            <span className="text-xs font-mono text-[#9a9a9a]">
              ({filteredDetections.length} recorded targets)
            </span>
          </div>

          {/* Priority filter pills */}
          <div className="flex items-center gap-1.5 text-xs font-sans">
            <span className="text-[#9a9a9a] mr-1 hidden sm:inline font-mono text-[11px]">FILTER:</span>
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1 rounded-md text-xs transition-all ${
                  priorityFilter === p
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'bg-white/5 text-[#d8d8d8] hover:text-white border border-white/10'
                }`}
              >
                {p === 'ALL' ? 'All' : p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Compact Detection Table */}
        <div className="rounded-xl border border-white/15 bg-black/80 overflow-hidden">
          {filteredDetections.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-xs font-sans text-[#9a9a9a]">
              <FileText className="w-8 h-8 opacity-40 mb-3" />
              {stats.processedFrames === 0 ? (
                <span>No mission detections logged yet. Process frames in the Image Queue or run Detection.</span>
              ) : (
                <span>No detections matching the selected priority filter.</span>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                id="detection-report-table"
                className="w-full text-left text-xs divide-y divide-white/10 font-sans"
              >
                <thead className="bg-white/5 text-[#9a9a9a] uppercase text-[10px] tracking-wider font-mono">
                  <tr>
                    <th scope="col" className="py-3 px-4">
                      FRAME
                    </th>
                    <th scope="col" className="py-3 px-4">
                      DETECTION
                    </th>
                    <th scope="col" className="py-3 px-4">
                      CONFIDENCE
                    </th>
                    <th scope="col" className="py-3 px-4">
                      PRIORITY
                    </th>
                    <th scope="col" className="py-3 px-4 hidden md:table-cell">
                      HAZARD BRIEFING
                    </th>
                    <th scope="col" className="py-3 px-4 text-right">
                      ACTION
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white">
                  {filteredDetections.map((row) => (
                    <tr
                      key={row.detection.id}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => handleInspectRow(row.frameId)}
                    >
                      {/* FRAME */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-semibold text-white">
                          FRAME {String(row.frameNumber).padStart(2, '0')}
                        </span>
                        <span className="block text-[10px] font-mono text-[#9a9a9a]">
                          {row.sector}
                        </span>
                      </td>

                      {/* DETECTION */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-white font-mono font-bold text-[11px]">
                          HUMAN
                        </span>
                        <span className="block text-[9px] font-mono text-[#9a9a9a] mt-0.5">
                          SIMULATED
                        </span>
                      </td>

                      {/* CONFIDENCE */}
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        {Math.round(row.detection.confidence * 100)}%
                      </td>

                      {/* PRIORITY */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            row.detection.priority === 'CRITICAL'
                              ? 'bg-red-950 text-red-200 border border-red-500'
                              : row.detection.priority === 'HIGH'
                              ? 'bg-amber-950 text-amber-200 border border-amber-500'
                              : 'bg-emerald-950 text-emerald-200 border border-emerald-500'
                          }`}
                        >
                          {row.detection.priority}
                        </span>
                      </td>

                      {/* HAZARD BRIEFING */}
                      <td className="py-3 px-4 text-[#d8d8d8] hidden md:table-cell max-w-xs truncate font-sans text-xs">
                        {row.detection.hazardNotes || 'Perimeter search subject'}
                      </td>

                      {/* ACTION */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectRow(row.frameId);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-white/20 bg-white/5 hover:bg-white/15 text-xs text-white transition-all font-sans font-medium"
                        >
                          <span>Inspect</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
