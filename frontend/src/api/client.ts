import axios from 'axios';
import type { ScenarioResult, SystemHealth, RegionPreset } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

export const getHealth = async (): Promise<SystemHealth> => {
  const { data } = await api.get<SystemHealth>('/api/v1/health');
  return data;
};

export const getPresets = async (): Promise<{
  default_region: string;
  regions: Record<string, RegionPreset>;
  sample_images: { filename: string; full_path: string }[];
}> => {
  const { data } = await api.get('/api/v1/scenarios/presets');
  return data;
};

export const runDefaultScenario = async (): Promise<ScenarioResult> => {
  const { data } = await api.post<ScenarioResult>('/api/v1/scenarios/run-default');
  return data;
};

export const analyzeUploadedImage = async (
  file: File,
  regionPreset: string = 'mumbai_coast',
  bbox?: { south: number; north: number; west: number; east: number }
): Promise<ScenarioResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('region_preset', regionPreset);

  if (bbox) {
    formData.append('south', bbox.south.toString());
    formData.append('north', bbox.north.toString());
    formData.append('west', bbox.west.toString());
    formData.append('east', bbox.east.toString());
  }

  const { data } = await api.post<ScenarioResult>('/api/v1/scenarios/analyze-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};
