import React, { useState } from 'react';
import { X, UploadCloud, FileImage, Loader2, AlertCircle } from 'lucide-react';
import type { RegionPreset } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  regions: Record<string, RegionPreset>;
  sampleImages?: { filename: string; full_path: string }[];
  onUpload: (file: File, regionKey: string) => Promise<void>;
  isLoading: boolean;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  regions,
  onUpload,
  isLoading,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('mumbai_coast');
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

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

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select a SAR image file.');
      return;
    }
    try {
      await onUpload(selectedFile, selectedRegion);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Analysis failed. Check server logs.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono select-none">
      <div className="bg-tactical-dark border border-tactical-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-tactical-border flex items-center justify-between bg-tactical-darker">
          <div className="flex items-center space-x-2">
            <UploadCloud className="w-5 h-5 text-tactical-accent" />
            <span className="font-bold text-slate-100 text-sm tracking-wide">
              UPLOAD NEW SAR RADAR SCENE
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded bg-red-950/60 border border-red-800 text-red-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Region Selector */}
          <div>
            <label className="block text-slate-400 font-bold mb-1.5 text-[11px]">
              TARGET MARITIME SECTOR
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full bg-tactical-surface border border-tactical-border rounded-md px-3 py-2 text-slate-200 outline-none focus:border-tactical-accent"
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
            <label className="block text-slate-400 font-bold mb-1.5 text-[11px]">
              SATELLITE RASTER FILE (.tif / .png)
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-tactical-accent bg-tactical-accent/10'
                  : selectedFile
                  ? 'border-tactical-success bg-tactical-success/10'
                  : 'border-tactical-border hover:border-slate-500 bg-tactical-darker'
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
                <div className="text-tactical-success font-bold truncate">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <>
                  <div className="text-slate-300 font-bold">Drag & drop SAR raster here</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Supports GeoTIFF, Sentinel-1 crops, and PNGs
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notice on Adaptive Metocean */}
          <div className="p-2.5 rounded bg-tactical-darker border border-tactical-border/60 text-[10px] text-slate-400">
            <span className="text-tactical-accent font-bold">INFO: </span>
            If NetCDF climate grids are not present for the uploaded coordinate, the auto-adaptive physics engine automatically calculates local monsoon drift vectors.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-tactical-border bg-tactical-darker flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-md bg-tactical-surface border border-tactical-border text-slate-300 hover:text-white text-xs"
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !selectedFile}
            className="flex items-center space-x-2 px-4 py-2 rounded-md bg-tactical-accent text-tactical-darkest font-bold text-xs hover:bg-cyan-300 disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>ANALYZING...</span>
              </>
            ) : (
              <span>RUN FULL ANALYSIS</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
