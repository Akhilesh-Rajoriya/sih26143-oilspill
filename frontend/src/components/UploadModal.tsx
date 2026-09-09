import React, { useState } from 'react';
import { X, FileImage, Loader2, AlertCircle, Compass, CheckCircle2, Waves, Ship, Globe, Sparkles, MapPin } from 'lucide-react';
import { fromBlob } from 'geotiff';
import type { RegionPreset } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  regions: Record<string, RegionPreset>;
  sampleImages?: { filename: string; full_path: string }[];
  onUpload: (
    file: File,
    regionKey: string,
    bbox?: { south: number; north: number; west: number; east: number },
    sectorName?: string
  ) => Promise<void>;
  onSelectPreset?: (regionKey: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Decodes GeoTIFF or large images in the browser and optimizes them to a 512x512
 * multi-channel raster (<150 KB) to ensure ultra-fast uploads and eliminate
 * 502 cloud proxy timeouts on free tiers.
 */
async function optimizeSarRaster(
  file: File,
  onStatusUpdate?: (msg: string) => void
): Promise<{ file: File; detectedBbox?: { south: number; north: number; west: number; east: number } }> {
  const isTiff = file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');

  if (isTiff) {
    onStatusUpdate?.(`Decoding GeoTIFF ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);
    try {
      const tiff = await fromBlob(file);
      const image = await tiff.getImage();
      const origW = image.getWidth();
      const origH = image.getHeight();

      // Check for embedded bounding box
      let detectedBbox: { south: number; north: number; west: number; east: number } | undefined;
      try {
        const rawBbox = image.getBoundingBox();
        if (rawBbox && rawBbox.length === 4) {
          const [w, s, e, n] = rawBbox;
          if (s >= -90 && n <= 90 && w >= -180 && e <= 180 && s < n && w < e) {
            detectedBbox = { south: s, north: n, west: w, east: e };
          }
        }
      } catch (err) {
        console.warn('Could not extract GeoTIFF bbox:', err);
      }

      // Decimate to max 512x512
      const maxDim = 512;
      const scale = Math.max(origW / maxDim, origH / maxDim, 1);
      const outW = Math.max(32, Math.round(origW / scale));
      const outH = Math.max(32, Math.round(origH / scale));

      onStatusUpdate?.(`Optimizing raster to ${outW}x${outH}...`);
      const rasters = await image.readRasters({ width: outW, height: outH });

      const numChannels = rasters.length;
      const ch0 = rasters[0] as ArrayLike<number>;
      const ch1 = (numChannels > 1 ? rasters[1] : rasters[0]) as ArrayLike<number>;

      let min0 = Infinity, max0 = -Infinity;
      let min1 = Infinity, max1 = -Infinity;
      for (let i = 0; i < ch0.length; i++) {
        const v0 = ch0[i];
        if (!isNaN(v0)) {
          if (v0 < min0) min0 = v0;
          if (v0 > max0) max0 = v0;
        }
        const v1 = ch1[i];
        if (!isNaN(v1)) {
          if (v1 < min1) min1 = v1;
          if (v1 > max1) max1 = v1;
        }
      }
      const range0 = max0 - min0 || 1;
      const range1 = max1 - min1 || 1;

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imgData = ctx.createImageData(outW, outH);
        for (let i = 0; i < ch0.length; i++) {
          const norm0 = Math.min(255, Math.max(0, Math.round(((ch0[i] - min0) / range0) * 255)));
          const norm1 = Math.min(255, Math.max(0, Math.round(((ch1[i] - min1) / range1) * 255)));
          const blend = Math.round((norm0 + norm1) / 2);

          imgData.data[i * 4] = norm0;
          imgData.data[i * 4 + 1] = norm1;
          imgData.data[i * 4 + 2] = blend;
          imgData.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const cleanName = `${file.name.replace(/\.[^/.]+$/, '')}_decimated.png`;
          const optFile = new File([blob], cleanName, { type: 'image/png' });
          console.log(`[GeoTIFF Decimation] Converted ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) -> ${cleanName} (${(blob.size / 1024).toFixed(1)} KB)`);
          return { file: optFile, detectedBbox };
        }
      }
    } catch (e) {
      console.warn('GeoTIFF client decimation fallback:', e);
    }
  }

  // If standard image > 2MB
  if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
    try {
      onStatusUpdate?.('Resizing image in browser...');
      const bitmap = await createImageBitmap(file);
      const maxDim = 512;
      const scale = Math.max(bitmap.width / maxDim, bitmap.height / maxDim, 1);
      const outW = Math.round(bitmap.width / scale);
      const outH = Math.round(bitmap.height / scale);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, outW, outH);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          return { file: new File([blob], file.name, { type: 'image/png' }) };
        }
      }
    } catch (e) {
      console.warn('Canvas resize fallback:', e);
    }
  }

  return { file };
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
  const [createNewSector, setCreateNewSector] = useState<boolean>(true);
  const [customSectorName, setCustomSectorName] = useState<string>('');
  const [detectedBbox, setDetectedBbox] = useState<{ south: number; north: number; west: number; east: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
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

  const onFileChosen = async (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    setStatusMsg(null);
    const base = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setCustomSectorName(`Sector: ${base.toUpperCase()}`);

    if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
      try {
        const tiff = await fromBlob(file);
        const image = await tiff.getImage();
        const rawBbox = image.getBoundingBox();
        if (rawBbox && rawBbox.length === 4) {
          const [w, s, e, n] = rawBbox;
          if (s >= -90 && n <= 90 && w >= -180 && e <= 180 && s < n && w < e) {
            setDetectedBbox({ south: s, north: n, west: w, east: e });
          }
        }
      } catch (e) {
        console.log('No embedded geo tags in GeoTIFF:', e);
      }
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChosen(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileChosen(e.target.files[0]);
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
      // 1. Optimize GeoTIFF or large image in browser
      const { file: optimizedFile, detectedBbox: embeddedBbox } = await optimizeSarRaster(
        selectedFile,
        (msg) => setStatusMsg(msg)
      );

      setStatusMsg('Executing SAR inference & vessel attribution...');
      const targetBbox = detectedBbox || embeddedBbox || (regions[selectedRegion]?.bbox ? {
        south: regions[selectedRegion].bbox.south,
        north: regions[selectedRegion].bbox.north,
        west: regions[selectedRegion].bbox.west,
        east: regions[selectedRegion].bbox.east,
      } : undefined);

      const sectorName = createNewSector ? (customSectorName.trim() || `Sector: ${selectedFile.name}`) : undefined;

      await onUpload(optimizedFile, selectedRegion, targetBbox, sectorName);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail ||
        err.message ||
        'Analysis failed. Please ensure file is a valid image (.tif, .png, .jpg).'
      );
    } finally {
      setStatusMsg(null);
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

          {statusMsg && (
            <div className="p-3 rounded-lg bg-blue-950/60 border border-blue-800 text-blue-200 text-xs flex items-center space-x-2.5 animate-pulse">
              <Loader2 className="w-4 h-4 shrink-0 text-blue-400 animate-spin" />
              <span>{statusMsg}</span>
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
                    <div className="space-y-1">
                      <div className="text-emerald-300 font-semibold text-xs">
                        {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-center space-x-1">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>Automatic in-browser optimization active</span>
                      </div>
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

              {/* Maritime Sector Attribution Section */}
              <div className="space-y-2 p-3 bg-slate-800/40 border border-slate-700/70 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>Maritime Sector Assignment</span>
                  </span>
                  <div className="flex items-center space-x-1.5 bg-slate-900/80 p-0.5 rounded-lg border border-slate-700/80">
                    <button
                      type="button"
                      onClick={() => setCreateNewSector(true)}
                      className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                        createNewSector ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      + New Sector
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateNewSector(false)}
                      className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                        !createNewSector ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Existing Sector
                    </button>
                  </div>
                </div>

                {createNewSector ? (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">
                        New Operational Maritime Sector Name
                      </label>
                      <input
                        type="text"
                        value={customSectorName}
                        onChange={(e) => setCustomSectorName(e.target.value)}
                        placeholder="e.g. Sector: CUSTOM SCENE 00001"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs outline-none focus:border-blue-500 font-medium"
                      />
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-start space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        {detectedBbox ? (
                          <b className="text-emerald-300 font-mono">
                            Auto-detected GPS bounds: {detectedBbox.south.toFixed(2)}°N to {detectedBbox.north.toFixed(2)}°N, {detectedBbox.west.toFixed(2)}°E to {detectedBbox.east.toFixed(2)}°E
                          </b>
                        ) : (
                          <span>
                            This new maritime sector will be permanently added to the <b>Operational Sector dropdown</b> in the Navbar upon analysis.
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1">
                    <label className="block text-slate-400 text-[10px] mb-1">
                      Assign to Existing Maritime Sector
                    </label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-blue-500 text-xs"
                    >
                      {Object.entries(regions).map(([key, r]) => (
                        <option key={key} value={key}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Automatic Cloud Optimization Note */}
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <b>Automatic Decimation & Cloud Safety:</b> High-resolution GeoTIFF files are processed with direct browser raster extraction, preventing timeouts and ensuring sub-second inference.
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
                  <span>{statusMsg || 'Processing Scene...'}</span>
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
