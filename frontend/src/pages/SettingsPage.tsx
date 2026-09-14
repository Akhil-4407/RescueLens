import React from 'react';
import {
  Cpu,
  Layers,
  ArrowDown,
  ShieldCheck,
  ShieldX,
  Radio,
  CheckCircle2,
  Terminal,
  AlertCircle,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { useMission } from '../state/MissionContext';

export const SettingsPage: React.FC = () => {
  const {
    activeService,
    switchInferenceAdapter,
    confidenceThreshold,
    setConfidenceThreshold,
    backendStatus,
    isBackendConnected,
  } = useMission();
  const info = activeService.getEngineInfo();

  const architectureSteps = [
    { name: 'USER DEVICE', desc: 'Host client browser / local edge hardware' },
    { name: 'REACT UI', desc: 'Workstation event dispatch and canvas coordinator' },
    { name: 'IMAGE CANVAS INGEST', desc: 'Raw RGBA pixel buffer extraction (416×416×3)' },
    { name: 'YOLO TINY / TENSORFLOW LITE', desc: 'Client-side neural network operator (FP16)' },
    { name: 'ON-DEVICE INFERENCE', desc: 'Zero cloud latency; zero remote API payload transfer' },
    { name: 'DETECTION COORDINATES', desc: 'Normalized bounding box anchors & confidence output' },
    { name: 'RESCUE PRIORITY', desc: 'Hazard triage heuristic (CRITICAL, HIGH, MEDIUM)' },
    { name: 'RESCUE EYE UI', desc: 'Operational tactical overlay and debrief report' },
  ];

  return (
    <div id="settings-page" className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="border-b border-white/10 pb-4">
        <span className="text-[11px] font-mono tracking-widest text-[#9a9a9a] uppercase">
          HARDWARE & ENGINE SPECIFICATIONS
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight font-sans">
          On-Device Inference Engine
        </h1>
      </div>

      {/* Architecture Flow Diagram per Section 18 */}
      <div className="p-6 rounded-xl border border-white/15 bg-black/70 backdrop-blur-md">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white mb-5 flex items-center gap-2 font-sans">
          <Terminal className="w-4 h-4 text-[#9a9a9a]" />
          On-Device Pipeline Architecture
        </h2>

        <div className="flex flex-col gap-2 max-w-2xl mx-auto">
          {architectureSteps.map((step, index) => (
            <React.Fragment key={step.name}>
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-mono">
                <span className="font-bold text-white tracking-wide">
                  {step.name}
                </span>
                <span className="text-[#9a9a9a] text-[11px] hidden sm:inline">
                  {step.desc}
                </span>
              </div>
              {index < architectureSteps.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ArrowDown className="w-4 h-4 text-white/30" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Interactive Operational Confidence Threshold Slider */}
      <div className="p-6 rounded-xl border border-white/15 bg-black/70 backdrop-blur-md flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-white" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white font-sans">
              Tactical Detection Confidence Threshold
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#9a9a9a]">CURRENT CUTOFF:</span>
            <span className="px-2.5 py-0.5 rounded bg-white text-black font-mono font-bold text-xs">
              {Math.round(confidenceThreshold * 100)}% ({confidenceThreshold.toFixed(2)})
            </span>
          </div>
        </div>

        <p className="text-xs text-[#9a9a9a] leading-relaxed font-sans">
          Dynamically tune the computer vision detection cutoff. Lower thresholds (0.15 – 0.30) eliminate false negatives on distant aerial humans in rubble/water terrain. Higher thresholds (0.50 – 0.90) enforce strict high-confidence verification.
        </p>

        {/* Interactive Range Slider */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-[#9a9a9a] shrink-0">0.10 (High Recall)</span>
            <input
              id="confidence-threshold-slider"
              type="range"
              min="0.10"
              max="0.90"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-emerald-400 transition-all"
            />
            <span className="text-xs font-mono text-[#9a9a9a] shrink-0">0.90 (High Precision)</span>
          </div>

          {/* Tactical Indicator Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-[#9a9a9a]">STATUS:</span>
              <span
                className={`font-semibold ${
                  confidenceThreshold <= 0.25
                    ? 'text-amber-400'
                    : confidenceThreshold <= 0.45
                    ? 'text-emerald-400'
                    : 'text-cyan-400'
                }`}
              >
                {confidenceThreshold <= 0.25
                  ? 'HIGH RECALL // DYNAMIC ELIMINATION OF FALSE NEGATIVES'
                  : confidenceThreshold <= 0.45
                  ? 'BALANCED TACTICAL SEARCH & RESCUE MODE (RECOMMENDED)'
                  : 'HIGH PRECISION // STRICT SURVIVOR VERIFICATION'}
              </span>
            </div>

            <button
              id="btn-reset-confidence"
              onClick={() => setConfidenceThreshold(0.30)}
              className="text-xs font-mono text-[#9a9a9a] hover:text-white flex items-center gap-1 transition-colors underline"
              title="Reset to recommended default (0.30)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Default (0.30)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Adapter & Specifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Inference Adapter Box */}
        <div className="p-5 sm:p-6 rounded-xl border border-white/15 bg-black/70 backdrop-blur-md flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white font-sans">
            Active Inference Adapter
          </h2>

          {/* Option 1: MockInferenceService (Active Demo) */}
          <div
            onClick={() => switchInferenceAdapter('mock')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              activeService.id === 'mock-inference'
                ? 'border-white bg-white/10 ring-1 ring-white/40 shadow-md'
                : 'border-white/10 bg-white/[0.02] opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold text-white">
                MockInferenceService
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500">
                ACTIVE — DEMO
              </span>
            </div>
            <p className="text-xs text-[#9a9a9a] mt-2 leading-relaxed font-sans">
              Deterministic search-and-rescue computer vision simulation. Replicates YOLO Tiny bounding box outputs for drone footage verification without cloud API dependencies.
            </p>
          </div>

          {/* Option 2: TensorFlowLiteInferenceService (Drop-In Target) */}
          <div
            onClick={() => switchInferenceAdapter('tflite')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              activeService.id === 'tflite-yolo-tiny'
                ? 'border-white bg-white/10 ring-1 ring-white/40 shadow-md'
                : 'border-white/10 bg-white/[0.02] opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold text-white">
                TensorFlowLiteInferenceService
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-[#d8d8d8] border border-white/20">
                {isBackendConnected ? 'CONNECTED — PRODUCTION' : 'DROP-IN TARGET'}
              </span>
            </div>
            <p className="text-xs text-[#9a9a9a] mt-2 leading-relaxed font-sans">
              Production drop-in interface designed for Wasm / WebGL TensorFlow Lite engine running quantized FP16 YOLO Tiny model weights directly in browser memory.
            </p>
          </div>
        </div>

        {/* Technical Engine Specifications per Section 18 */}
        <div className="p-5 sm:p-6 rounded-xl border border-white/15 bg-black/70 backdrop-blur-md flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white font-sans mb-1">
            Model & Framework Specifications
          </h2>

          <div className="divide-y divide-white/10 text-xs font-mono">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9a9a9a]">MODEL ARCHITECTURE</span>
              <span className="font-bold text-white">YOLO TINY</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9a9a9a]">EXECUTION FRAMEWORK</span>
              <span className="font-bold text-white">TENSORFLOW LITE — CLIENT SIDE</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9a9a9a]">TARGET RESOLUTION</span>
              <span className="font-bold text-white">416 × 416 × 3 RGB</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9a9a9a]">QUANTIZATION</span>
              <span className="font-bold text-white">FP16</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9a9a9a]">CLOUD VISION</span>
              <span className="font-bold text-red-400 flex items-center gap-1">
                <ShieldX className="w-3.5 h-3.5" />
                DISABLED
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9a9a9a]">OPENAI / GEMINI API</span>
              <span className="font-bold text-red-400 flex items-center gap-1">
                <ShieldX className="w-3.5 h-3.5" />
                DISABLED
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-white/10 bg-white/5 text-xs font-sans text-[#9a9a9a] leading-relaxed mt-2">
            <strong className="text-white block mb-1 font-mono text-[11px]">STRICT INTEGRITY PROTOCOL</strong>
            All benchmarks, latency measures, and accuracy metrics are strictly omitted until real on-device model weights are loaded to prevent misleading operational readiness data.
          </div>
        </div>
      </div>
    </div>
  );
};
