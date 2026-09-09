import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { TacticalMap } from './components/TacticalMap';
import { TemporalScrubber } from './components/TemporalScrubber';
import { SuspectTriagePanel } from './components/SuspectTriagePanel';
import { UploadModal } from './components/UploadModal';
import { IncidentDossier } from './components/IncidentDossier';
import { getHealth, getPresets, runDefaultScenario, runPresetScenario, analyzeUploadedImage } from './api/client';
import type { ScenarioResult, SystemHealth, RegionPreset } from './types';

export const App: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [regions, setRegions] = useState<Record<string, RegionPreset>>({});
  const [sampleImages, setSampleImages] = useState<{ filename: string; full_path: string }[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('mumbai_coast');

  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [timeOffsetHours, setTimeOffsetHours] = useState<number>(0);
  const [selectedMmsi, setSelectedMmsi] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);

  // Initialize health & presets
  useEffect(() => {
    const init = async () => {
      try {
        const h = await getHealth();
        setHealth(h);
      } catch (err) {
        console.warn('Backend API offline or unreachable at port 8000.');
      }

      try {
        const p = await getPresets();
        setRegions(p.regions);
        setSampleImages(p.sample_images);
        if (p.default_region) setSelectedRegion(p.default_region);
      } catch (err) {
        console.warn('Failed to load presets.');
      }
    };
    init();
  }, []);

  // 1-Click Run Flagship Scenario
  const handleRunDefault = async () => {
    setIsLoading(true);
    try {
      const res = await runDefaultScenario();
      setScenario(res);
      setSelectedRegion('mumbai_coast');
      setTimeOffsetHours(0);
      if (res.candidates.length > 0) {
        setSelectedMmsi(res.candidates[0].mmsi);
      }
    } catch (err: any) {
      alert(`Simulation failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Run Selected Benchmark Preset (Mumbai, Gujarat, Ennore)
  const handleSelectPreset = async (regionKey: string) => {
    setIsLoading(true);
    try {
      const res = await runPresetScenario(regionKey);
      setScenario(res);
      setSelectedRegion(regionKey);
      setTimeOffsetHours(0);
      if (res.candidates.length > 0) {
        setSelectedMmsi(res.candidates[0].mmsi);
      }
    } catch (err: any) {
      alert(`Simulation failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload custom image with new maritime sector registration
  const handleUploadImage = async (
    file: File,
    regionKey: string,
    bbox?: { south: number; north: number; west: number; east: number },
    sectorName?: string
  ) => {
    setIsLoading(true);
    try {
      const res = await analyzeUploadedImage(file, regionKey, bbox, sectorName);
      setScenario(res);

      if (res.metadata?.custom_sector) {
        const sec = res.metadata.custom_sector;
        const newKey = sec.key || `custom_${Date.now()}`;
        setRegions((prev) => ({
          ...prev,
          [newKey]: {
            name: sec.name || sectorName || 'Custom Operational Sector',
            bbox: sec.bbox || (bbox || { south: 18.6, north: 19.4, west: 72.4, east: 73.2 }),
          },
        }));
        setSelectedRegion(newKey);
      } else {
        setSelectedRegion(regionKey);
      }

      setTimeOffsetHours(0);
      if (res.candidates.length > 0) {
        setSelectedMmsi(res.candidates[0].mmsi);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReport = () => {
    setIsDossierOpen(true);
  };

  return (
    <>
      {/* Screen Layout (Hidden during print) */}
      <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans print:hidden">
        {/* Top Navigation */}
        <Navbar
          health={health}
          regions={regions}
          selectedRegion={selectedRegion}
          onSelectRegion={(reg) => {
            setSelectedRegion(reg);
            handleSelectPreset(reg);
          }}
          onRunDefault={handleRunDefault}
          onOpenUpload={() => setIsUploadOpen(true)}
          onExportReport={handleExportReport}
          isLoading={isLoading}
          executionTime={scenario?.execution_time_seconds}
        />

        {/* Main Tactical Ops Center Viewport */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left/Center: Interactive Geospatial Tactical Map */}
          <div className="flex-1 flex flex-col h-full relative">
            <TacticalMap
              scenario={scenario}
              timeOffsetHours={timeOffsetHours}
              selectedMmsi={selectedMmsi}
              onSelectVessel={setSelectedMmsi}
              regionName={regions[selectedRegion]?.name}
            />

            {/* Bottom Interactive Temporal Scrubber Slider */}
            <TemporalScrubber
              timeOffset={timeOffsetHours}
              onChangeTimeOffset={setTimeOffsetHours}
              detectionTimestamp={scenario?.slick.timestamp}
            />
          </div>

          {/* Right: Suspect Vessel Triage & Evidence Panel */}
          <SuspectTriagePanel
            scenario={scenario}
            selectedMmsi={selectedMmsi}
            onSelectVessel={setSelectedMmsi}
          />
        </div>

        {/* Custom SAR Upload Modal */}
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          regions={regions}
          sampleImages={sampleImages}
          onUpload={handleUploadImage}
          onSelectPreset={handleSelectPreset}
          isLoading={isLoading}
        />

        {/* Incident Dossier Preview Modal */}
        <IncidentDossier
          scenario={scenario}
          regionName={regions[selectedRegion]?.name}
          isOpen={isDossierOpen}
          onClose={() => setIsDossierOpen(false)}
        />
      </div>

      {/* Official Legal Evidence Print Container (Active strictly during window.print) */}
      <IncidentDossier
        scenario={scenario}
        regionName={regions[selectedRegion]?.name}
        isPrintOnly={true}
      />
    </>
  );
};

export default App;
