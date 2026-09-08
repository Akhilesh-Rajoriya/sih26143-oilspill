import React from 'react';
import { Shield, Play, Upload, Cpu, Radio, MapPin, FileText, Loader2 } from 'lucide-react';
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
    <header className="h-16 bg-tactical-darker/90 backdrop-blur border-b border-tactical-border px-4 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Project Identity */}
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-tactical-accent/10 border border-tactical-accent/40 text-tactical-accent shadow-[0_0_12px_rgba(6,182,212,0.3)]">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-base tracking-wider text-white">SIH-26143</span>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-tactical-accent/30 text-tactical-accent font-mono">
              NTRO DEFENSE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono tracking-wide">
            SATELLITE SAR OIL SPILL DETECTION & AIS ATTRIBUTION SYSTEM
          </p>
        </div>
      </div>

      {/* Center Controls: Region Preset & Telemetry */}
      <div className="hidden md:flex items-center space-x-3">
        {/* Region Selector */}
        <div className="flex items-center space-x-2 bg-tactical-dark border border-tactical-border px-2.5 py-1.5 rounded-md text-xs font-mono">
          <MapPin className="w-3.5 h-3.5 text-tactical-accent" />
          <span className="text-slate-400">SECTOR:</span>
          <select
            value={selectedRegion}
            onChange={(e) => onSelectRegion(e.target.value)}
            className="bg-transparent text-slate-200 outline-none cursor-pointer pr-2 font-mono"
            disabled={isLoading}
          >
            {Object.entries(regions).map(([key, r]) => (
              <option key={key} value={key} className="bg-tactical-dark text-slate-200">
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Hardware Telemetry Badge */}
        <div className="flex items-center space-x-2 bg-tactical-dark border border-tactical-border px-2.5 py-1.5 rounded-md text-xs font-mono">
          <Cpu className="w-3.5 h-3.5 text-tactical-accent" />
          <span className="text-slate-400">ENGINE:</span>
          {health ? (
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-tactical-success animate-pulse" />
              <span className="text-tactical-success font-medium">
                {health.cuda_accelerated ? 'CUDA RTX 3050' : 'CPU MODE'}
              </span>
            </div>
          ) : (
            <span className="text-slate-500">CONNECTING...</span>
          )}
        </div>

        {executionTime !== undefined && (
          <div className="hidden lg:flex items-center space-x-1.5 bg-tactical-accent/10 border border-tactical-accent/30 px-2.5 py-1.5 rounded-md text-xs font-mono text-tactical-accent">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>SOLVED IN: {executionTime.toFixed(2)}s</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* 1-Click Flagship Scenario */}
        <button
          onClick={onRunDefault}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-md bg-tactical-accent text-tactical-darkest font-semibold text-xs tracking-wider transition-all duration-200 hover:bg-cyan-300 hover:shadow-[0_0_16px_rgba(6,182,212,0.5)] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>PROCESSING...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>RUN FLAGSHIP SCENARIO</span>
            </>
          )}
        </button>

        {/* Upload Custom Image */}
        <button
          onClick={onOpenUpload}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-tactical-surface border border-tactical-border text-slate-200 hover:text-tactical-accent hover:border-tactical-accent/50 text-xs font-mono transition-all duration-150 active:scale-95 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">ANALYZE NEW SAR</span>
        </button>

        {/* Export Report */}
        <button
          onClick={onExportReport}
          className="p-2 rounded-md bg-tactical-surface border border-tactical-border text-slate-300 hover:text-white hover:border-slate-500 text-xs transition-all duration-150"
          title="Print Intelligence Dossier"
        >
          <FileText className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
