import React, { useState } from 'react';
import { X, FileImage, Loader2, AlertCircle, Compass, CheckCircle2, Waves, Ship, Globe } from 'lucide-react';
import type { RegionPreset } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  regions: Record<string, RegionPreset>;
  sampleImages?: { filename: string; full_path: string }[];
  onUpload: (file: File, regionKey: string) => Promise<void>;
  onSelectPreset?: (regionKey: string) => Promise<void>;
  isLoading: boolean;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  regions,
  onUpload,
  onSelectPreset,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'upload'>('benchmarks');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('mumbai_coast');
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const benchmarkCards = [
    {
      key: 'global_corridor',
      title: 'Global Maritime Strategic Corridor',
      badge: '100% Real SAR + Metocean + AIS',
      isGlobalReal: true,
      icon: Globe,
      desc: 'Strait of Hormuz / Gulf of Oman international tanker transit channel. Ingests 100% real ESA Sentinel-1 SAR imagery, CMEMS/ERA5 hydrodynamics, and real-world historical corridor AIS telemetry with suspect VLCC dark-period detection.',
      coordinates: '25.24° N, 57.13° E',
    },
    {
      key: 'mumbai_coast',
      title: 'Mumbai High Offshore Basin',
      badge: 'Verified Sentinel-1 Scene',
      isGlobalReal: false,
      icon: Waves,
      desc: 'Active 77.87 km² crude slick detected in Arabian Sea shipping lane. Features 4h AIS blackout by suspect tanker.',
      coordinates: '18.95° N, 72.80° E',
    },
    {
      key: 'gujarat_kutch',
      title: 'Gulf of Kutch Maritime Approach',
      badge: 'Tanker Transit Corridor',
      isGlobalReal: false,
      icon: Ship,
      desc: 'Heavy crude transit channel with complex shallow-water tidal currents and rapid shoreline trajectory projection.',
      coordinates: '22.50° N, 69.80° E',
    },
    {
      key: 'ennore_port',
      title: 'Ennore Coastal Anchorage & Port',
      badge: 'Port & Anchorage Zone',
      isGlobalReal: false,
      icon: Compass,
      desc: 'Commercial harbor approaches simulating acute bunker fuel discharge and sensitive coastal threat assessment.',
      coordinates: '13.30° N, 80.30° E',
    },
  ];

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleRunPreset = async (key: string) => {
    setErrorMsg(null);
    try {
      if (onSelectPreset) {
        await onSelectPreset(key);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to execute preset scenario.');
    }
  };

  const handleSubmitUpload = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select a satellite image or GeoTIFF file.');
      return;
    }
    setErrorMsg(null);
    try {
      await onUpload(selectedFile, selectedRegion);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Analysis failed. Please ensure file is a valid image (.tif, .png, .jpg).');
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 select-none">
      <div className="relative z-10 bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <h2 className="font-semibold text-white text-base tracking-tight">
              Satellite SAR Scene Analysis
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute U-Net oil spill segmentation, Lagrangian drift, and AIS vessel attribution
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-800 flex space-x-2 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('benchmarks')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'benchmarks'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Pre-loaded Benchmark Scenes
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Upload Custom SAR File
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'benchmarks' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Select an operational maritime sector to run an instant analysis:
              </p>
              <div className="space-y-2.5">
                {benchmarkCards.map((b) => {
                  const Icon = b.icon;
                  return (
                    <div
                      key={b.key}
                      onClick={() => !isLoading && handleRunPreset(b.key)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start space-x-3.5 group shadow-sm ${
                        b.isGlobalReal
                          ? 'border-emerald-700/60 hover:border-emerald-500 bg-emerald-950/20 hover:bg-emerald-950/30 ring-1 ring-emerald-600/30'
                          : 'border-slate-800 hover:border-blue-500/60 bg-slate-800/40 hover:bg-slate-800/80'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                          b.isGlobalReal
                            ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white'
                            : 'bg-blue-600/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-xs text-white group-hover:text-blue-300 transition-colors">
                              {b.title}
                            </span>
                            {b.isGlobalReal && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold tracking-wide">
                                ★ 100% REAL DATA
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-medium shrink-0">
                            {b.coordinates}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {b.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Region Selector */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5 text-xs">
                  Operational Maritime Sector
                </label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-blue-500"
                >
                  {Object.entries(regions).map(([key, r]) => (
                    <option key={key} value={key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropzone */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5 text-xs">
                  Sentinel-1 SAR Raster File (.tif, .png, .jpg)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    dragOver
                      ? 'border-blue-500 bg-blue-500/10'
                      : selectedFile
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
                  }`}
                  onClick={() => document.getElementById('sar-file-input')?.click()}
                >
                  <input
                    id="sar-file-input"
                    type="file"
                    accept=".tif,.tiff,.png,.jpg,.jpeg"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <FileImage className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  {selectedFile ? (
                    <div className="text-emerald-300 font-medium text-xs">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  ) : (
                    <>
                      <div className="text-slate-200 font-medium">Click to browse or drop file here</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Accepts GeoTIFF, Sentinel-1 VV/VH radar scenes, PNG, and JPG rasters
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Adaptive Drift Note */}
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <b>Automatic Cloud Optimization:</b> Large satellite scenes are dynamically preprocessed in memory to maintain sub-second response times without exceeding memory limits.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end space-x-2.5">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all"
          >
            Cancel
          </button>
          {activeTab === 'upload' && (
            <button
              onClick={handleSubmitUpload}
              disabled={isLoading || !selectedFile}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs disabled:opacity-50 transition-all shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Scene...</span>
                </>
              ) : (
                <span>Run Analysis</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

