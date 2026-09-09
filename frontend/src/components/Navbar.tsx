import React from 'react';
import { Compass, Play, UploadCloud, Cpu, MapPin, FileDown, Loader2, CheckCircle2 } from 'lucide-react';
import type { SystemHealth, RegionPreset } from '../types';

interface NavbarProps {
  health: SystemHealth | null;
  regions: Record<string, RegionPreset>;
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
  onRunDefault: () => void;
  onOpenUpload: () => void;
  onExportReport: () => void;
  isLoading: boolean;
  executionTime?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  regions,
  selectedRegion,
  onSelectRegion,
  onRunDefault,
  onOpenUpload,
  onExportReport,
  isLoading,
  executionTime,
}) => {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-5 flex items-center justify-between z-30 shrink-0 select-none shadow-sm">
      {/* Brand & Institutional Identity */}
      <div className="flex items-center space-x-3.5">
        <div className="w-10 h-10 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="font-semibold text-sm tracking-tight text-white">
              National Maritime Domain Awareness
            </h1>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
              SIH-26143 • NTRO
            </span>
          </div>
          <p className="text-xs text-slate-400 font-normal">
            Satellite SAR Oil Spill Surveillance & AIS Attribution System
          </p>
        </div>
      </div>

      {/* Center Controls: Operational Sector & System Telemetry */}
      <div className="hidden lg:flex items-center space-x-3 text-xs">
        {/* Sector Selector */}
        <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/70 px-3 py-1.5 rounded-lg shadow-sm">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400 font-medium">Sector:</span>
          <select
            value={selectedRegion}
            onChange={(e) => onSelectRegion(e.target.value)}
            className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer pr-1"
            disabled={isLoading}
          >
            {Object.entries(regions).map(([key, r]) => (
              <option key={key} value={key} className="bg-slate-800 text-slate-200">
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Engine Status */}
        <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/70 px-3 py-1.5 rounded-lg shadow-sm">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400 font-medium">System:</span>
          {health ? (
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-medium">
                {health.cuda_accelerated ? 'CUDA GPU Active' : 'Online (Cloud CPU)'}
              </span>
            </div>
          ) : (
            <span className="text-slate-500">Connecting...</span>
          )}
        </div>

        {/* Execution Speed Badge */}
        {executionTime !== undefined && (
          <div className="flex items-center space-x-1.5 bg-blue-950/40 border border-blue-800/50 px-3 py-1.5 rounded-lg text-blue-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium">Inference: {executionTime.toFixed(2)}s</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2.5">
        {/* Run Flagship Scenario */}
        <button
          onClick={onRunDefault}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running Simulation...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Flagship Scenario</span>
            </>
          )}
        </button>

        {/* Analyze SAR Scene (Upload / Benchmark) */}
        <button
          onClick={onOpenUpload}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
          <span>Analyze SAR Scene</span>
        </button>

        {/* Export Report */}
        <button
          onClick={onExportReport}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all shadow-sm"
          title="Print Incident Report Dossier"
        >
          <FileDown className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Export Dossier</span>
        </button>
      </div>
    </header>
  );
};
