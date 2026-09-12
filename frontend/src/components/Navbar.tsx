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
    <header className="h-[68px] min-h-[68px] bg-slate-900 border-b border-slate-800 px-4 lg:px-6 flex items-center justify-between z-30 shrink-0 select-none shadow-sm gap-2">
      {/* Brand & Institutional Identity */}
      <div className="flex items-center space-x-3 shrink-0 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner shrink-0">
          <Compass className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h1 className="font-semibold text-sm tracking-tight text-white whitespace-nowrap">
              National Maritime Domain Awareness
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 shrink-0">
              SIH-26143 · NTRO
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-normal leading-tight truncate max-w-xs md:max-w-sm lg:max-w-md">
            Satellite SAR Oil Spill Surveillance & AIS Attribution System
          </p>
        </div>
      </div>

      {/* Center Controls: Operational Sector & System Telemetry */}
      <div className="hidden md:flex items-center space-x-2 lg:space-x-3 text-xs shrink-0">
        {/* Sector Selector */}
        <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1.5 rounded-lg shadow-sm">
          <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-slate-400 font-medium">Sector:</span>
          <select
            value={selectedRegion}
            onChange={(e) => onSelectRegion(e.target.value)}
            className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer max-w-[130px] lg:max-w-[200px] truncate pr-1"
            disabled={isLoading}
          >
            {Object.entries(regions).map(([key, r]) => {
              const displayName = r.name.replace(/^sector[:\s]*/i, '');
              return (
                <option key={key} value={key} className="bg-slate-800 text-slate-200">
                  {displayName}
                </option>
              );
            })}
          </select>
        </div>

        {/* Engine Status */}
        <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1.5 rounded-lg shadow-sm">
          <Cpu className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-slate-400 font-medium">Engine:</span>
          {health ? (
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-medium text-[11px] whitespace-nowrap">
                {health.cuda_accelerated ? 'NVIDIA GPU' : 'Cloud CPU'}
              </span>
            </div>
          ) : (
            <span className="text-slate-500 text-[11px]">Connecting...</span>
          )}
        </div>

        {/* Execution Speed Badge */}
        {executionTime !== undefined && (
          <div className="hidden xl:flex items-center space-x-1.5 bg-blue-950/40 border border-blue-800/50 px-2.5 py-1.5 rounded-lg text-blue-300 text-[11px] shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono font-medium">{executionTime.toFixed(2)}s</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Run Flagship Scenario */}
        <button
          onClick={onRunDefault}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 lg:px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">Processing...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden lg:inline">Run Flagship</span>
              <span className="lg:hidden">Run</span>
            </>
          )}
        </button>

        {/* Analyze SAR Scene (Upload / Benchmark) */}
        <button
          onClick={onOpenUpload}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 lg:px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Analyze SAR</span>
          <span className="sm:hidden">Upload</span>
        </button>

        {/* Export Report / Dossier */}
        <button
          onClick={onExportReport}
          className="flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-all shadow-sm active:scale-95"
          title="Preview & Print Official Incident Dossier (PDF)"
        >
          <FileDown className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Dossier</span>
        </button>
      </div>
    </header>
  );
};
