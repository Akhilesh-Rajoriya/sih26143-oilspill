import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Circle, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Layers, Crosshair } from 'lucide-react';
import type { ScenarioResult, AISTrack } from '../types';

interface TacticalMapProps {
  scenario: ScenarioResult | null;
  timeOffsetHours: number;
  selectedMmsi: string | null;
  onSelectVessel: (mmsi: string) => void;
  regionName?: string;
}

// Automatically resolve geographical marine basin from GPS coordinates or scenario metadata
function getMaritimeZoneName(lat: number, lon: number, customName?: string): string {
  if (customName && !customName.toLowerCase().startsWith('scene') && !customName.toLowerCase().startsWith('sector') && !customName.toLowerCase().startsWith('custom')) {
    return customName;
  }
  // Geographical resolution
  if (lat >= 50 && lat <= 65 && lon >= -5 && lon <= 15) {
    return 'North Sea Maritime Zone';
  }
  if (lat >= 23 && lat <= 27 && lon >= 55 && lon <= 61) {
    return 'Strait of Hormuz / Gulf of Oman';
  }
  if (lat >= 21 && lat <= 24 && lon >= 68 && lon <= 71) {
    return 'Gulf of Kutch Shipping Channel';
  }
  if (lat >= 17 && lat <= 21 && lon >= 71 && lon <= 74) {
    return 'Mumbai Offshore High Basin';
  }
  if (lat >= 12 && lat <= 15 && lon >= 79 && lon <= 82) {
    return 'Ennore / Chennai Coastal Anchorage';
  }
  if (lat >= 5 && lat <= 25 && lon >= 65 && lon <= 77) {
    return 'Arabian Sea Corridor';
  }
  if (lat >= 5 && lat <= 25 && lon >= 78 && lon <= 95) {
    return 'Bay of Bengal Corridor';
  }
  if (customName) {
    return customName;
  }
  return `Maritime Zone (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`;
}

// Helper to re-center and frame map when scenario updates
const MapAutoRecenter: React.FC<{
  lat: number;
  lon: number;
  scenarioId?: string;
  polygon?: [number, number][];
}> = ({ lat, lon, scenarioId, polygon }) => {
  const map = useMap();
  useEffect(() => {
    if (polygon && polygon.length > 2) {
      try {
        const lats = polygon.map((p) => p[0]);
        const lons = polygon.map((p) => p[1]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const dLat = Math.max(maxLat - minLat, 0.05);
        const dLon = Math.max(maxLon - minLon, 0.05);
        map.flyToBounds(
          [
            [minLat - dLat * 0.8, minLon - dLon * 0.8],
            [maxLat + dLat * 0.8, maxLon + dLon * 0.8],
          ],
          { duration: 1.5, maxZoom: 11 }
        );
        return;
      } catch (e) {
        // Fallback
      }
    }
    map.flyTo([lat, lon], 10, { duration: 1.5 });
  }, [lat, lon, scenarioId, map]);
  return null;
};

export const TacticalMap: React.FC<TacticalMapProps> = ({
  scenario,
  timeOffsetHours,
  selectedMmsi,
  onSelectVessel,
  regionName,
}) => {
  const defaultCenter: [number, number] = [18.95, 72.80]; // Mumbai Coastal Waters

  const centerLat = scenario?.slick.centroid_lat || defaultCenter[0];
  const centerLon = scenario?.slick.centroid_lon || defaultCenter[1];

  // Interactive Layer Toggles
  const [layersOpen, setLayersOpen] = useState(true);
  const [showSlick, setShowSlick] = useState(true);
  const [showOrigin, setShowOrigin] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showTracks, setShowTracks] = useState(true);

  // Helper to interpolate vessel position along its track based on time offset
  const getInterpolatedVesselPosition = (track: AISTrack) => {
    if (!track.positions || track.positions.length === 0) return null;
    if (!scenario) return track.positions[0];

    // Reference detection time is t=0
    const refTime = new Date(scenario.slick.timestamp).getTime();
    const targetTime = refTime + timeOffsetHours * 3600 * 1000;

    // Find nearest reported AIS position
    let closest = track.positions[0];
    let minDiff = Infinity;
    for (const pos of track.positions) {
      const pTime = new Date(pos.timestamp).getTime();
      const diff = Math.abs(pTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pos;
      }
    }
    return closest;
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        {/* Esri World Dark Gray Basemap */}
        <TileLayer
          url="https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        {/* Geographic Reference Labels (Cities, Ports, Boundaries) */}
        <TileLayer
          url="https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />

        {scenario && (
          <MapAutoRecenter
            lat={centerLat}
            lon={centerLon}
            scenarioId={scenario.scenario_id}
            polygon={scenario.slick.polygon}
          />
        )}

        {scenario && (
          <>
            {/* 1. Detected Oil Slick Polygon */}
            {showSlick && scenario.slick.polygon.length > 2 && (
              <Polygon
                positions={scenario.slick.polygon}
                pathOptions={{
                  color: '#dc2626',
                  weight: 3,
                  fillColor: '#ef4444',
                  fillOpacity: timeOffsetHours === 0 ? 0.65 : 0.35,
                  dashArray: timeOffsetHours === 0 ? undefined : '4, 4',
                }}
              >
                <Popup>
                  <div className="p-2 text-xs text-slate-800 space-y-1.5">
                    <div className="font-bold text-red-600 border-b pb-1 flex items-center justify-between">
                      <span>Oil Spill Detection (Sentinel-1 SAR)</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono">U-Net</span>
                    </div>
                    <div>Estimated Surface Area: <b>{scenario.slick.area_km2.toFixed(2)} km²</b></div>
                    <div>Perimeter: <b>{scenario.slick.perimeter_km.toFixed(2)} km</b></div>
                    <div>SAR Likelihood Confidence: <b>{(scenario.slick.oil_likelihood_confidence * 100).toFixed(1)}%</b></div>
                    <div>Weathering Stage: <span className="capitalize font-semibold text-amber-800">{scenario.slick.age_class}</span></div>
                    <div className="text-[11px] font-mono text-slate-600 pt-1 border-t">
                      Centroid: {scenario.slick.centroid_lat.toFixed(4)}°N, {scenario.slick.centroid_lon.toFixed(4)}°E
                    </div>
                  </div>
                </Popup>
              </Polygon>
            )}

            {/* Slick Centroid Pulsing Beacon Marker */}
            {showSlick && (
              <>
                <CircleMarker
                  center={[scenario.slick.centroid_lat, scenario.slick.centroid_lon]}
                  radius={7}
                  pathOptions={{ color: '#ffffff', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}
                >
                  <Popup>
                    <div className="p-1 text-xs text-slate-800 font-semibold">
                      Spill Core Centroid: {scenario.slick.centroid_lat.toFixed(4)}°N, {scenario.slick.centroid_lon.toFixed(4)}°E
                    </div>
                  </Popup>
                </CircleMarker>
                <CircleMarker
                  center={[scenario.slick.centroid_lat, scenario.slick.centroid_lon]}
                  radius={16}
                  pathOptions={{ color: '#ef4444', fillColor: 'transparent', fillOpacity: 0, weight: 1.5, dashArray: '4, 4' }}
                />
              </>
            )}

            {/* 2. Hindcast Spill Origin Uncertainty Window */}
            {showOrigin && (
              <Circle
                center={[scenario.origin.center_lat, scenario.origin.center_lon]}
                radius={scenario.origin.radius_km * 1000}
                pathOptions={{
                  color: '#0284c7',
                  weight: 2,
                  dashArray: '6, 6',
                  fillColor: '#38bdf8',
                  fillOpacity: timeOffsetHours < 0 ? 0.25 : 0.12,
                }}
              >
                <Popup>
                  <div className="p-1.5 text-xs text-slate-800 space-y-1">
                    <div className="font-semibold text-sky-700 border-b pb-1">
                      Drift Origin Window (Hindcast ±48h)
                    </div>
                    <div>Estimated Center: <b>{scenario.origin.center_lat.toFixed(4)}°N, {scenario.origin.center_lon.toFixed(4)}°E</b></div>
                    <div>Search Radius: <b>±{scenario.origin.radius_km.toFixed(2)} km</b></div>
                    <div>Model Confidence: <b>{(scenario.origin.confidence * 100).toFixed(0)}%</b></div>
                    <div className="text-[11px] text-slate-600">
                      Calculated via Lagrangian back-propagation with local hydrodynamic current & wind advection.
                    </div>
                  </div>
                </Popup>
              </Circle>
            )}

            {/* 3. Forward Forecast Drift Trajectory Path */}
            {showForecast && scenario.forecast.points.length > 1 && (
              <>
                <Polyline
                  positions={scenario.forecast.points.map((pt) => [pt.lat, pt.lon])}
                  pathOptions={{
                    color: '#38bdf8',
                    weight: 2.5,
                    dashArray: '5, 8',
                    opacity: 0.85,
                  }}
                />

                {scenario.forecast.points
                  .filter((_, idx) => idx % 6 === 0 || idx === scenario.forecast.points.length - 1)
                  .map((pt, idx) => (
                    <CircleMarker
                      key={`forecast-node-${idx}`}
                      center={[pt.lat, pt.lon]}
                      radius={3}
                      pathOptions={{ color: '#0284c7', fillColor: '#bae6fd', fillOpacity: 1, weight: 1.5 }}
                    >
                      <Popup>
                        <div className="p-1 text-xs text-slate-800">
                          <div className="font-semibold text-sky-700">Dispersion Node T+{idx * 3}h</div>
                          <div>Dispersion Spread: ±{pt.uncertainty_km.toFixed(2)} km</div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
              </>
            )}

            {/* 4. AIS Candidate Tracks and Vessel Markers */}
            {showTracks && scenario.candidate_tracks.map((track) => {
              if (!track || !track.positions || track.positions.length === 0) return null;

              const candidate = scenario.candidates.find((c) => c.mmsi === track.mmsi);
              const isSelected = selectedMmsi === track.mmsi;
              const isSuspect = candidate ? candidate.rank === 1 && candidate.total_score >= 0.5 : false;
              const pos = getInterpolatedVesselPosition(track);

              return (
                <React.Fragment key={track.mmsi}>
                  {/* Historical AIS Track Line */}
                  <Polyline
                    positions={track.positions.map((p) => [p.lat, p.lon] as [number, number])}
                    pathOptions={{
                      color: isSuspect ? '#ef4444' : isSelected ? '#3b82f6' : '#64748b',
                      weight: isSelected ? 3 : isSuspect ? 2.5 : 1.5,
                      opacity: isSelected || isSuspect ? 0.95 : 0.45,
                    }}
                    eventHandlers={{
                      click: () => onSelectVessel(track.mmsi),
                    }}
                  />

                  {/* Scrubber Active Position Marker */}
                  {pos && (
                    <CircleMarker
                      center={[pos.lat, pos.lon]}
                      radius={isSuspect ? 7 : 5}
                      eventHandlers={{
                        click: () => onSelectVessel(track.mmsi),
                      }}
                      pathOptions={{
                        color: isSuspect ? '#dc2626' : isSelected ? '#2563eb' : '#94a3b8',
                        fillColor: isSuspect ? '#ef4444' : '#1e293b',
                        fillOpacity: 0.9,
                        weight: isSelected ? 3 : 2,
                      }}
                    >
                      <Popup>
                        <div className="p-1.5 text-xs text-slate-800 space-y-1">
                          <div className={`font-semibold ${isSuspect ? 'text-red-600' : 'text-slate-900'}`}>
                            {track.vessel_name || 'Commercial Vessel'} ({track.mmsi})
                          </div>
                          <div>Vessel Class: <b>{track.vessel_type}</b></div>
                          <div>Speed Over Ground: <b>{pos.speed_over_ground} knots</b></div>
                          <div>Course Over Ground: <b>{pos.course_over_ground}°</b></div>
                          {isSuspect && candidate ? (
                            <div className="mt-1 text-red-700 font-semibold text-[11px] bg-red-50 p-1.5 rounded border border-red-200">
                              Primary Attributed Suspect ({(candidate.total_score * 100).toFixed(1)}% Match)
                            </div>
                          ) : (
                            <div className="mt-1 text-emerald-700 font-medium text-[11px] bg-emerald-50 p-1 rounded border border-emerald-200">
                              Cleared Commercial Transit
                            </div>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}
      </MapContainer>

      {/* Map Layers & Legend Widget (Top-Left) */}
      <div className="absolute top-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-xl shadow-lg select-none text-xs w-64 overflow-hidden">
        <div
          onClick={() => setLayersOpen(!layersOpen)}
          className="p-3 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white text-xs">Surveillance Layers</span>
          </div>
          <span className="text-slate-400 text-[10px] font-medium">
            {layersOpen ? 'Hide' : 'Show'}
          </span>
        </div>

        {layersOpen && (
          <div className="p-3 space-y-2.5">
            <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={showSlick}
                onChange={(e) => setShowSlick(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-slate-800"
              />
              <span className="w-3 h-3 rounded-sm bg-red-500/60 border border-red-500 shrink-0" />
              <span className="text-slate-200 text-xs">Oil Slick Contour (SAR)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={showOrigin}
                onChange={(e) => setShowOrigin(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-slate-800"
              />
              <span className="w-3 h-3 rounded-full border border-dashed border-sky-400 bg-sky-500/20 shrink-0" />
              <span className="text-slate-200 text-xs">Origin Window (Hindcast)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={showForecast}
                onChange={(e) => setShowForecast(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-slate-800"
              />
              <span className="w-3.5 h-0.5 border-t-2 border-dashed border-sky-400 shrink-0" />
              <span className="text-slate-200 text-xs">Drift Forecast (Shoreline)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={showTracks}
                onChange={(e) => setShowTracks(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-slate-800"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-slate-200 text-xs">AIS Tracks & Suspects</span>
            </label>
          </div>
        )}
      </div>

      {/* Dynamic Coordinates & Geographical Zone Indicator (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-lg px-3 py-1.5 shadow-md flex items-center space-x-2 text-[11px] text-slate-300">
        <Crosshair className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="font-mono text-slate-200">{centerLat.toFixed(4)}°N, {centerLon.toFixed(4)}°E</span>
        <span className="text-slate-500">•</span>
        <span className="text-blue-300 font-medium">{getMaritimeZoneName(centerLat, centerLon, regionName)}</span>
      </div>
    </div>
  );
};
