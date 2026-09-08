import React from 'react';
import { AlertTriangle, CheckCircle2, Anchor, Radar } from 'lucide-react';
import type { ScenarioResult } from '../types';

interface SuspectTriagePanelProps {
  scenario: ScenarioResult | null;
  selectedMmsi: string | null;
  onSelectVessel: (mmsi: string) => void;
}

export const SuspectTriagePanel: React.FC<SuspectTriagePanelProps> = ({
  scenario,
  selectedMmsi,
  onSelectVessel,
}) => {
  if (!scenario) {
    return (
      <aside className="w-96 bg-tactical-darker/95 backdrop-blur border-l border-tactical-border p-5 flex flex-col justify-center items-center text-center font-mono text-xs select-none">
        <Radar className="w-12 h-12 text-tactical-accent/40 animate-radar-pulse mb-3" />
        <div className="font-bold text-slate-300 mb-1">AWAITING SURVEILLANCE RUN</div>
        <p className="text-slate-500 text-[11px] max-w-xs">
          Click <b>"Run Flagship Scenario"</b> or upload an image to trigger U-Net segmentation, drift hindcast, and AIS attribution.
        </p>
      </aside>
    );
  }

  const primarySuspect = scenario.candidates[0];

  return (
    <aside className="w-96 bg-tactical-darker/95 backdrop-blur border-l border-tactical-border flex flex-col h-full overflow-hidden select-none font-mono text-xs z-10">
      {/* Panel Header */}
      <div className="p-4 border-b border-tactical-border bg-tactical-dark shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-200 tracking-wider flex items-center space-x-1.5">
            <Anchor className="w-4 h-4 text-tactical-accent" />
            <span>VESSEL ATTRIBUTION</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-tactical-surface text-slate-400 border border-tactical-border text-[11px]">
            {scenario.candidates.length} CANDIDATES
          </span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          Ranked by multi-factor Bayesian attribution against the origin window.
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Slick Physical Telemetry Card */}
        <div className="p-3 rounded-lg bg-tactical-dark border border-tactical-border/70 text-[11px] space-y-2">
          <div className="flex items-center justify-between text-slate-400 font-bold border-b border-tactical-border pb-1">
            <span>SAR SLICK GEOMETRY</span>
            <span className="text-red-400 uppercase">{scenario.slick.age_class}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div>
              <span className="text-slate-500 block text-[10px]">SURFACE AREA</span>
              <span className="font-bold text-white text-sm">{scenario.slick.area_km2.toFixed(2)} km²</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">AI CONFIDENCE</span>
              <span className="font-bold text-tactical-accent text-sm">{(scenario.slick.oil_likelihood_confidence * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">PERIMETER</span>
              <span>{scenario.slick.perimeter_km.toFixed(2)} km</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">ORIGIN RADIUS</span>
              <span>±{scenario.origin.radius_km.toFixed(2)} km</span>
            </div>
          </div>
        </div>

        {/* Primary Suspect Card (Highlighted) */}
        {primarySuspect && (
          <div
            onClick={() => onSelectVessel(primarySuspect.mmsi)}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              selectedMmsi === primarySuspect.mmsi
                ? 'bg-red-950/40 border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.3)]'
                : 'bg-red-950/20 border-red-800/80 hover:border-red-600'
            }`}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 text-red-400 font-bold">
                <AlertTriangle className="w-4 h-4 animate-bounce" />
                <span>PRIMARY SUSPECT #1</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[11px]">
                {(primarySuspect.total_score * 100).toFixed(1)}% THREAT
              </span>
            </div>

            {/* Vessel Identity */}
            <div className="text-sm font-bold text-white mb-0.5">
              {primarySuspect.vessel_name || 'MT Ocean Pioneer'}
            </div>
            <div className="text-[11px] text-slate-400 mb-3 flex items-center space-x-2">
              <span>MMSI: {primarySuspect.mmsi}</span>
              <span>•</span>
              <span className="text-amber-400">{primarySuspect.vessel_type}</span>
            </div>

            {/* Score Breakdown Bars */}
            <div className="space-y-1.5 text-[10px] bg-tactical-darkest/60 p-2.5 rounded border border-red-900/50 mb-3">
              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span>Proximity Match (35%)</span>
                  <span className="font-bold">{(primarySuspect.proximity_score * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1 bg-tactical-surface rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${primarySuspect.proximity_score * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span>Track Intercept (20%)</span>
                  <span className="font-bold">{(primarySuspect.trajectory_score * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1 bg-tactical-surface rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${primarySuspect.trajectory_score * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span>Speed Anomaly (10%)</span>
                  <span className="font-bold">{(primarySuspect.anomaly_score * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1 bg-tactical-surface rounded-full overflow-hidden">
                  <div className="h-full bg-red-400" style={{ width: `${primarySuspect.anomaly_score * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Red Anomaly Flags */}
            {primarySuspect.anomaly_flags.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                  TACTICAL ANOMALY FLAGS:
                </div>
                {primarySuspect.anomaly_flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-red-900/30 border border-red-700/50 text-[10px] text-red-300 flex items-start space-x-1.5"
                  >
                    <span className="text-red-400 font-bold">•</span>
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Innocent / Other Candidates List */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            OTHER EVALUATED VESSELS:
          </div>

          {scenario.candidates.slice(1).map((vessel) => {
            const isSelected = selectedMmsi === vessel.mmsi;
            return (
              <div
                key={vessel.mmsi}
                onClick={() => onSelectVessel(vessel.mmsi)}
                className={`p-2.5 rounded-md border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-tactical-surface border-tactical-accent'
                    : 'bg-tactical-dark border-tactical-border hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-slate-200 truncate max-w-[180px]">
                    #{vessel.rank} {vessel.vessel_name || vessel.mmsi}
                  </div>
                  <div className="flex items-center space-x-1 text-tactical-success text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>CLEARED</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{vessel.vessel_type}</span>
                  <span className="font-bold text-slate-300">
                    Score: {(vessel.total_score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
