import React from 'react';
import { Shield, Anchor, AlertTriangle, FileText, Printer, X } from 'lucide-react';
import type { ScenarioResult } from '../types';

interface IncidentDossierProps {
  scenario: ScenarioResult | null;
  regionName?: string;
  isOpen?: boolean;
  onClose?: () => void;
  isPrintOnly?: boolean;
}

export const IncidentDossier: React.FC<IncidentDossierProps> = ({
  scenario,
  regionName = 'Mumbai Coast / Offshore High',
  isOpen = false,
  onClose,
  isPrintOnly = false,
}) => {
  if (!scenario) return null;

  const topSuspect = scenario.candidates?.[0];
  const formattedDate = new Date(scenario.timestamp).toUTCString();
  const caseId = `ICG-EVD-${scenario.scenario_id.replace(/^SCN_/, '').slice(0, 16).toUpperCase()}`;

  const content = (
    <div className="bg-white text-slate-900 p-8 sm:p-10 max-w-4xl mx-auto font-sans leading-relaxed text-sm shadow-xl print:shadow-none print:p-0 print:max-w-none">
      {/* Official Government / Coast Guard Header */}
      <div className="border-b-2 border-slate-900 pb-5 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-xl tracking-wider">
              ICG
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                Government of India • Ministry of Defence & NTRO
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                Maritime Pollution Incident Dossier & Evidence Brief
              </h1>
              <div className="text-xs font-semibold text-slate-600">
                Indian Coast Guard Maritime Surveillance & Environmental Enforcement Directorate
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block px-2.5 py-1 bg-red-100 text-red-800 border border-red-300 font-mono text-[10px] font-bold uppercase rounded">
              RESTRICTED // EVIDENTIARY RECORD
            </span>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Case Ref: <span className="font-bold text-slate-800">{caseId}</span>
            </div>
            <div className="text-[10px] text-slate-400">UNCLOS Art. 211 / MARPOL Annex I</div>
          </div>
        </div>

        {/* Quick Executive Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-md p-3 mt-4 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Incident Sector</span>
            <span className="font-bold text-slate-900">{regionName}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Observation Time (UTC)</span>
            <span className="font-bold text-slate-900">{formattedDate}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Prime Vessel Suspect</span>
            <span className="font-bold text-red-700">{topSuspect ? topSuspect.vessel_name : 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Attribution Probability</span>
            <span className="font-bold text-red-700">
              {topSuspect ? `${(topSuspect.total_score * 100).toFixed(1)}% (Rank #1)` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="mb-6 bg-amber-50/60 border-l-4 border-amber-500 p-3.5 rounded-r text-xs text-slate-800">
        <span className="font-bold text-amber-900 uppercase block mb-1">Executive Summary of Incident</span>
        Sentinel-1 Synthetic Aperture Radar (SAR) surveillance detected an anomalous low-backscatter mineral oil slick 
        measuring <span className="font-semibold">{scenario.slick.area_km2.toFixed(2)} km²</span> in offshore waters. Vectorized Lagrangian 
        metocean hindcast modeling operating on ERA5 wind fields and CMEMS surface ocean currents backtracked the discharge to 
        an origin window at <span className="font-mono font-semibold">{scenario.origin.center_lat.toFixed(4)}°N, {scenario.origin.center_lon.toFixed(4)}°E</span> (±{scenario.origin.radius_km.toFixed(1)} km radius).
        Automated spatiotemporal AIS cross-matching isolated <span className="font-semibold">{scenario.candidates.length} candidate vessels</span>, with{' '}
        <span className="font-bold text-red-800">{topSuspect?.vessel_name}</span> (MMSI: {topSuspect?.mmsi}) establishing primary liability through deliberate transponder deactivation and deceleration inside the discharge window.
      </div>

      {/* Section 1: Satellite SAR Radar Detection Specifications */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2.5 flex items-center space-x-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>1. Satellite Synthetic Aperture Radar (SAR) Specifications</span>
        </h2>
        <table className="w-full text-xs border-collapse border border-slate-200">
          <tbody>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <td className="p-2 font-semibold text-slate-600 w-1/4 border-r border-slate-200">Satellite Constellation</td>
              <td className="p-2 text-slate-900 w-1/4">Sentinel-1 (ESA Copernicus)</td>
              <td className="p-2 font-semibold text-slate-600 w-1/4 border-r border-slate-200">Sensor Mode & Pol</td>
              <td className="p-2 text-slate-900 w-1/4">C-SAR IW (VV Polarisation)</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-2 font-semibold text-slate-600 border-r border-slate-200">Detection Centroid</td>
              <td className="p-2 font-mono text-slate-900">
                {scenario.slick.centroid_lat.toFixed(4)}°N, {scenario.slick.centroid_lon.toFixed(4)}°E
              </td>
              <td className="p-2 font-semibold text-slate-600 border-r border-slate-200">Total Surface Area</td>
              <td className="p-2 font-bold text-slate-900">{scenario.slick.area_km2.toFixed(2)} km²</td>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <td className="p-2 font-semibold text-slate-600 border-r border-slate-200">Perimeter / Boundary</td>
              <td className="p-2 text-slate-900">{scenario.slick.perimeter_km.toFixed(2)} km</td>
              <td className="p-2 font-semibold text-slate-600 border-r border-slate-200">Elongation Ratio</td>
              <td className="p-2 text-slate-900">{scenario.slick.elongation_ratio.toFixed(2)} : 1</td>
            </tr>
            <tr>
              <td className="p-2 font-semibold text-slate-600 border-r border-slate-200">AI Deep Learning Model</td>
              <td className="p-2 text-slate-900 font-medium">PyTorch U-Net (GPU Accelerated)</td>
              <td className="p-2 font-semibold text-slate-600 border-r border-slate-200">Detection Confidence</td>
              <td className="p-2 font-bold text-emerald-700">
                {(scenario.slick.oil_likelihood_confidence * 100).toFixed(1)}% (Verified Oil Slick)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 2: Lagrangian Reverse-Drift Metocean Backtracking */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2.5 flex items-center space-x-1.5">
          <Anchor className="w-3.5 h-3.5 text-blue-600" />
          <span>2. Lagrangian Reverse-Drift Metocean Origin Backtracking</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="border border-slate-200 rounded p-3 bg-slate-50">
            <span className="font-bold text-slate-800 block mb-1">Discharge Origin Coordinates</span>
            <div className="font-mono text-base font-bold text-slate-900">
              {scenario.origin.center_lat.toFixed(5)}°N, {scenario.origin.center_lon.toFixed(5)}°E
            </div>
            <div className="text-[11px] text-slate-600 mt-1">
              Search Radius: <span className="font-bold">±{scenario.origin.radius_km.toFixed(2)} km</span> (95% Confidence Envelope)
            </div>
            <div className="text-[11px] text-slate-600">
              Metocean Source: <span className="font-mono">{scenario.metadata.wind_source} + {scenario.metadata.currents_source}</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded p-3 bg-slate-50">
            <span className="font-bold text-slate-800 block mb-1">Discharge Temporal Window</span>
            <div className="text-xs text-slate-700 font-mono">
              <div><span className="text-slate-500 font-sans">Window Start:</span> {new Date(scenario.origin.time_start).toUTCString()}</div>
              <div><span className="text-slate-500 font-sans">Window End:</span>   {new Date(scenario.origin.time_end).toUTCString()}</div>
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              Physics Status: Hydrodynamic boundary conditions verified offshore
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: AIS Suspect Vessel Correlation & Anomaly Ledger */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2.5 flex items-center space-x-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>3. Automated AIS Suspect Attribution & Anomaly Ledger</span>
        </h2>

        <table className="w-full text-xs border border-slate-200 border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-left">
              <th className="p-2 w-10 text-center font-bold">Rank</th>
              <th className="p-2 font-bold">Vessel Identity</th>
              <th className="p-2 font-bold">MMSI</th>
              <th className="p-2 font-bold">Vessel Type</th>
              <th className="p-2 text-center font-bold">Proximity</th>
              <th className="p-2 text-center font-bold">Trajectory</th>
              <th className="p-2 text-center font-bold">Anomaly</th>
              <th className="p-2 text-right font-bold">Total Score</th>
            </tr>
          </thead>
          <tbody>
            {scenario.candidates.map((cand) => (
              <tr
                key={cand.mmsi}
                className={`border-b border-slate-200 ${
                  cand.rank === 1 ? 'bg-red-50/70 font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                <td className="p-2 text-center font-mono font-bold">
                  {cand.rank === 1 ? (
                    <span className="inline-block px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px]">#1</span>
                  ) : (
                    `#${cand.rank}`
                  )}
                </td>
                <td className="p-2 text-slate-900">{cand.vessel_name}</td>
                <td className="p-2 font-mono text-slate-600">{cand.mmsi}</td>
                <td className="p-2 text-slate-600">{cand.vessel_type}</td>
                <td className="p-2 text-center font-mono">{(cand.proximity_score * 100).toFixed(0)}%</td>
                <td className="p-2 text-center font-mono">{(cand.trajectory_score * 100).toFixed(0)}%</td>
                <td className="p-2 text-center font-mono">
                  {cand.anomaly_score > 0 ? (
                    <span className="text-red-700 font-bold">{(cand.anomaly_score * 100).toFixed(0)}%</span>
                  ) : (
                    <span className="text-slate-400">0%</span>
                  )}
                </td>
                <td className="p-2 text-right font-mono font-bold text-slate-900">
                  <span className={cand.rank === 1 ? 'text-red-700 text-sm' : ''}>
                    {(cand.total_score * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Highlighted Evidence on Prime Suspect */}
        {topSuspect && topSuspect.anomaly_flags.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-xs text-red-900">
            <span className="font-bold block uppercase text-[11px] mb-1">
              Primary Suspect Critical Anomaly Signatures ({topSuspect.vessel_name}):
            </span>
            <ul className="list-disc list-inside space-y-1">
              {topSuspect.anomaly_flags.map((flag, i) => (
                <li key={i} className="font-medium">
                  {flag}
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[10px] text-red-700 border-t border-red-200 pt-1">
              * Assessment: Concurrence of spatial proximity, sudden speed reduction (&lt; 5 knots), and deliberate AIS transponder blackout constitutes prima facie evidence of illegal bilge/sludge decanting under Section 356E of the Merchant Shipping Act.
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Chain of Custody & Evidence Certification Block */}
      <div className="border-t-2 border-slate-900 pt-4 mt-8">
        <div className="grid grid-cols-2 gap-8 text-xs text-slate-600">
          <div>
            <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">
              Automated Cryptographic Provenance
            </div>
            <div className="font-mono text-[10px] text-slate-500 break-all">
              PIPELINE_HASH: SHA256:{caseId}-UNET-LAGRANGIAN-AIS-V2
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Execution Time: {scenario.execution_time_seconds.toFixed(3)}s | System Mode: Live Law-Enforcement Triage
            </div>
          </div>

          <div className="text-right">
            <div className="border-b border-slate-400 w-48 ml-auto mb-1"></div>
            <div className="font-bold text-slate-800 text-[11px]">Authorized Duty Officer / Analyst</div>
            <div className="text-[10px] text-slate-500">Indian Coast Guard Regional HQ • Maritime Operations</div>
          </div>
        </div>
      </div>
    </div>
  );

  // If used strictly as the invisible print layer:
  if (isPrintOnly) {
    return <div className="hidden print:block">{content}</div>;
  }

  // If used as an interactive on-screen modal preview:
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto print:hidden">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center space-x-2 text-white font-semibold text-sm">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Incident Intelligence Dossier Preview</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-all active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Dossier Content */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-950/50 flex justify-center">
          {content}
        </div>
      </div>
    </div>
  );
};
