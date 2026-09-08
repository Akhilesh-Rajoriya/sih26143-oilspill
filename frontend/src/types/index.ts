export interface SlickDetection {
  slick_id: string;
  centroid_lat: number;
  centroid_lon: number;
  timestamp: string;
  polygon: [number, number][]; // [lat, lon] vertices
  area_km2: number;
  perimeter_km: number;
  elongation_ratio: number;
  oil_likelihood_confidence: number;
  age_class: 'fresh' | 'moderate' | 'weathered';
}

export interface OriginWindow {
  slick_id: string;
  center_lat: number;
  center_lon: number;
  radius_km: number;
  time_start: string;
  time_end: string;
  confidence: number;
}

export interface ForecastPoint {
  lat: number;
  lon: number;
  timestamp: string;
  uncertainty_km: number;
}

export interface ForecastPath {
  slick_id: string;
  points: ForecastPoint[];
}

export interface AISPosition {
  lat: number;
  lon: number;
  timestamp: string;
  speed_over_ground: number;
  course_over_ground: number;
}

export interface AISTrack {
  mmsi: string;
  vessel_name?: string;
  vessel_type: string;
  positions: AISPosition[];
}

export interface VesselScore {
  mmsi: string;
  vessel_name?: string;
  vessel_type: string;
  proximity_score: number;
  trajectory_score: number;
  anomaly_score: number;
  total_score: number;
  rank: number;
  anomaly_flags: string[];
}

export interface ScenarioResult {
  scenario_id: string;
  timestamp: string;
  slick: SlickDetection;
  origin: OriginWindow;
  forecast: ForecastPath;
  candidates: VesselScore[];
  candidate_tracks: AISTrack[];
  execution_time_seconds: number;
  metadata: {
    sar_method_used: string;
    sar_confidence: number;
    metocean_source: string;
    wind_source: string;
    currents_source: string;
    ais_mode: string;
    num_candidates: number;
  };
}

export interface SystemHealth {
  status: string;
  service: string;
  cuda_accelerated: boolean;
  device: string;
  model_weights_loaded: boolean;
  timestamp: string;
}

export interface RegionPreset {
  name: string;
  bbox: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
}

