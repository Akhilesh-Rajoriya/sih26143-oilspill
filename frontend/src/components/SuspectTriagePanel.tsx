import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Ship, ShieldAlert, Waves, Download } from 'lucide-react';
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
  const [filter, setFilter] = useState<'all' | 'suspects' | 'cleared'>('all');

  if (!scenario) {
    return (
      <aside className="w-96 bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-center items-center text-center text-xs select-none shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3.5 shadow-inner">
          <Ship className="w-7 h-7" />
        </div>
        <h3 className="font-semibold text-white text-sm mb-1.5">No Active Surveillance Run</h3>
        <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
          Click <b>"Run Flagship Scenario"</b> or upload a SAR scene to perform automated slick segmentation, Lagrangian drift simulation, and AIS vessel attribution.
        </p>
      </aside>
    );
  }

  const filteredCandidates = scenario.candidates.filter((c) => {
    if (filter === 'suspects') return c.total_score >= 0.5;
    if (filter === 'cleared') return c.total_score < 0.5;
    return true;
  });

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oil_spill_attribution_${scenario.scenario_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-[410px] bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden select-none text-xs z-10 shadow-lg">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-white text-sm">Vessel Attribution Dossier</h2>
          </div>
          <button
            onClick={handleDownloadJSON}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-700 transition-all"
            title="Download Investigation JSON"
          >
            <Download className="w-3 h-3" />
            <span>JSON</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Multi-factor Bayesian scoring matching AIS traffic to the hindcast origin window
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex space-x-1.5 shrink-0">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          All Vessels ({scenario.candidates.length})
        </button>
        <button
          onClick={() => setFilter('suspects')}
          className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
            filter === 'suspects'
              ? 'bg-red-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Flagged Suspects ({scenario.candidates.filter((c) => c.total_score >= 0.5).length})
        </button>
        <button
          onClick={() => setFilter('cleared')}
          className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
            filter === 'cleared'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Cleared ({scenario.candidates.filter((c) => c.total_score < 0.5).length})
        </button>
      </div>

      {/* Scrollable Investigation Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* Incident Summary Card */}
        <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
            <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <Waves className="w-3.5 h-3.5 text-blue-400" />
              <span>Slick Characteristics</span>
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 capitalize">
              {scenario.slick.age_class} Weathering
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[10px]">Surface Area</span>
              <span className="font-semibold text-white text-sm">{scenario.slick.area_km2.toFixed(2)} km²</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">SAR Confidence</span>
              <span className="font-semibold text-emerald-400 text-sm">
                {(scenario.slick.oil_likelihood_confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Centroid Coordinates</span>
              <span className="font-mono text-slate-300 text-[11px]">
                {scenario.slick.centroid_lat.toFixed(4)}°N, {scenario.slick.centroid_lon.toFixed(4)}°E
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Origin Search Radius</span>
              <span className="font-mono text-slate-300 text-[11px]">±{scenario.origin.radius_km.toFixed(2)} km</span>
            </div>
          </div>
        </div>

        {/* Candidate Vessel Attribution Cards */}
        <div className="space-y-3">
          {filteredCandidates.map((candidate) => {
            const isSelected = selectedMmsi === candidate.mmsi;
            const isHighRisk = candidate.total_score >= 0.5;

            return (
              <div
                key={candidate.mmsi}
                onClick={() => onSelectVessel(candidate.mmsi)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? isHighRisk
                      ? 'bg-red-950/40 border-red-500 shadow-md ring-1 ring-red-500/50'
                      : 'bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                    : isHighRisk
                    ? 'bg-red-950/20 border-red-800/60 hover:border-red-600/80'
                    : 'bg-slate-800/30 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                {/* Header row: Name and Score Badge */}
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="font-semibold text-white text-sm flex items-center space-x-1.5">
                      <span>{candidate.vessel_name || 'Vessel'}</span>
                      {isHighRisk && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white font-semibold uppercase">
                          SUSPECT #{candidate.rank}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1.5">
                      <span className="font-mono">MMSI: {candidate.mmsi}</span>
                      <span>•</span>
                      <span className="text-slate-300 font-medium">{candidate.vessel_type}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isHighRisk
                          ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {(candidate.total_score * 100).toFixed(1)}% Match
                    </span>
                  </div>
                </div>

                {/* Score Breakdown Progress Bars */}
                <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 mt-2.5 mb-2.5">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                      <span>Proximity (35%)</span>
                      <span className="font-medium text-slate-200">{(candidate.proximity_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${isHighRisk ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${candidate.proximity_score * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                      <span>Composite Attribution (Weighted)</span>
                      <span className="font-medium text-slate-200">{(candidate.total_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${isHighRisk ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${candidate.total_score * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                      <span>Trajectory Alignment (20%)</span>
                      <span className="font-medium text-slate-200">{(candidate.trajectory_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${isHighRisk ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${candidate.trajectory_score * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                      <span>Behavioral Anomaly Index (20%)</span>
                      <span className="font-medium text-slate-200">{(candidate.anomaly_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${isHighRisk ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${candidate.anomaly_score * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Behavioral Flags / Forensic Notes */}
                {candidate.anomaly_flags && candidate.anomaly_flags.length > 0 ? (
                  <div className="p-2 rounded-lg bg-red-950/40 border border-red-900/60 text-[11px] text-red-200 space-y-1">
                    <span className="font-semibold text-red-300 block text-[10px] uppercase tracking-wide">
                      Forensic Behavioral Anomalies:
                    </span>
                    {candidate.anomaly_flags.map((flag: string, idx: number) => (
                      <div key={idx} className="flex items-start space-x-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{flag}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Normal commercial cruising pattern; no anomalies detected.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
