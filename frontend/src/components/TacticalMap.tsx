import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Circle, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { ScenarioResult, AISTrack } from '../types';

interface TacticalMapProps {
  scenario: ScenarioResult | null;
  timeOffsetHours: number;
  selectedMmsi: string | null;
  onSelectVessel: (mmsi: string) => void;
}

// Helper to re-center map when scenario updates
const MapAutoRecenter: React.FC<{ lat: number; lon: number }> = ({ lat, lon }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 10, { duration: 1.5 });
  }, [lat, lon, map]);
  return null;
};

export const TacticalMap: React.FC<TacticalMapProps> = ({
  scenario,
  timeOffsetHours,
  selectedMmsi,
  onSelectVessel,
}) => {
  const defaultCenter: [number, number] = [18.95, 72.80]; // Mumbai Coastal Waters

  const centerLat = scenario?.slick.centroid_lat || defaultCenter[0];
  const centerLon = scenario?.slick.centroid_lon || defaultCenter[1];

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
    <div className="relative w-full h-full bg-tactical-darkest overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        {/* Esri World Dark Gray Tactical Basemap (No API Key Required) */}
        <TileLayer
          url="https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />

        {scenario && <MapAutoRecenter lat={centerLat} lon={centerLon} />}

        {scenario && (
          <>
            {/* 1. Detected Oil Slick Polygon (at T=0 or slight dispersion) */}
            {scenario.slick.polygon.length > 2 && (
              <Polygon
                positions={scenario.slick.polygon}
                pathOptions={{
                  color: '#ef4444',
                  weight: 2,
                  fillColor: '#ef4444',
                  fillOpacity: timeOffsetHours === 0 ? 0.55 : 0.25,
                  dashArray: timeOffsetHours === 0 ? undefined : '4, 4',
                }}
              >
                <Popup className="tactical-popup">
                  <div className="p-1 font-mono text-xs text-slate-800">
                    <div className="font-bold text-red-600 border-b pb-1 mb-1">
                      OIL SLICK DETECTED (SAR)
                    </div>
                    <div>Area: <b>{scenario.slick.area_km2.toFixed(2)} km²</b></div>
                    <div>Perimeter: {scenario.slick.perimeter_km.toFixed(2)} km</div>
                    <div>Elongation: {scenario.slick.elongation_ratio.toFixed(2)}</div>
                    <div>Confidence: <b>{(scenario.slick.oil_likelihood_confidence * 100).toFixed(1)}%</b></div>
                    <div>Classification: <span className="uppercase text-amber-700">{scenario.slick.age_class}</span></div>
                  </div>
                </Popup>
              </Polygon>
            )}

            {/* Slick Centroid Marker */}
            <CircleMarker
              center={[scenario.slick.centroid_lat, scenario.slick.centroid_lon]}
              radius={4}
              pathOptions={{ color: '#ef4444', fillColor: '#fee2e2', fillOpacity: 1, weight: 2 }}
            />

            {/* 2. Hindcast Spill Origin Uncertainty Window (Cyan Circle) */}
            <Circle
              center={[scenario.origin.center_lat, scenario.origin.center_lon]}
              radius={scenario.origin.radius_km * 1000}
              pathOptions={{
                color: '#06b6d4',
                weight: 2,
                dashArray: '6, 6',
                fillColor: '#06b6d4',
                fillOpacity: 0.15,
              }}
            >
              <Popup>
                <div className="p-1 font-mono text-xs text-slate-800">
                  <div className="font-bold text-cyan-700 border-b pb-1 mb-1">
                    ESTIMATED SPILL ORIGIN (HINDCAST)
                  </div>
                  <div>Center: ({scenario.origin.center_lat.toFixed(4)}, {scenario.origin.center_lon.toFixed(4)})</div>
                  <div>Search Radius: <b>{scenario.origin.radius_km.toFixed(2)} km</b></div>
                  <div>Release Window:</div>
                  <div className="text-[10px] text-slate-600">{scenario.origin.time_start}</div>
                  <div className="text-[10px] text-slate-600">{scenario.origin.time_end}</div>
                  <div>Model Confidence: <b>{(scenario.origin.confidence * 100).toFixed(1)}%</b></div>
                </div>
              </Popup>
            </Circle>

            {/* Origin Crosshair Center */}
            <CircleMarker
              center={[scenario.origin.center_lat, scenario.origin.center_lon]}
              radius={3}
              pathOptions={{ color: '#06b6d4', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
            />

            {/* 3. Forecast Trajectory Path (Forward Drift) */}
            {scenario.forecast.points.length > 1 && (
              <>
                <Polyline
                  positions={scenario.forecast.points.map((p) => [p.lat, p.lon])}
                  pathOptions={{
                    color: '#38bdf8',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '4, 8',
                  }}
                />
                {/* Terminal Landfall Point */}
                <CircleMarker
                  center={[
                    scenario.forecast.points[scenario.forecast.points.length - 1].lat,
                    scenario.forecast.points[scenario.forecast.points.length - 1].lon,
                  ]}
                  radius={6}
                  pathOptions={{
                    color: '#f59e0b',
                    fillColor: '#f59e0b',
                    fillOpacity: 0.7,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="font-mono text-xs text-slate-800">
                      <div className="font-bold text-amber-600">PROJECTED LANDFALL THREAT</div>
                      <div>Max Uncertainty: ±{scenario.forecast.points[scenario.forecast.points.length - 1].uncertainty_km?.toFixed(2)} km</div>
                    </div>
                  </Popup>
                </CircleMarker>
              </>
            )}

            {/* 4. AIS Vessel Tracks & Scrubber-Synchronized Positions */}
            {scenario.candidate_tracks.map((track) => {
              const isSuspect = track.mmsi === scenario.candidates[0]?.mmsi;
              const isSelected = selectedMmsi === track.mmsi;
              const pos = getInterpolatedVesselPosition(track);
              const pathPositions = track.positions.map((p) => [p.lat, p.lon] as [number, number]);

              return (
                <React.Fragment key={track.mmsi}>
                  {/* Vessel Track Path Line */}
                  <Polyline
                    positions={pathPositions}
                    pathOptions={{
                      color: isSuspect ? '#ef4444' : '#64748b',
                      weight: isSelected || isSuspect ? 3 : 1.5,
                      opacity: isSuspect ? 0.85 : 0.4,
                      dashArray: isSuspect ? '6, 4' : undefined,
                    }}
                  />

                  {/* Scrubber Active Position Marker */}
                  {pos && (
                    <CircleMarker
                      center={[pos.lat, pos.lon]}
                      radius={isSuspect ? 8 : 5}
                      eventHandlers={{
                        click: () => onSelectVessel(track.mmsi),
                      }}
                      pathOptions={{
                        color: isSuspect ? '#ef4444' : isSelected ? '#06b6d4' : '#94a3b8',
                        fillColor: isSuspect ? '#ef4444' : '#1e293b',
                        fillOpacity: 0.9,
                        weight: isSelected ? 3 : 2,
                      }}
                    >
                      <Popup>
                        <div className="p-1 font-mono text-xs text-slate-800">
                          <div className={`font-bold ${isSuspect ? 'text-red-600' : 'text-slate-800'}`}>
                            {track.vessel_name || 'Vessel'} ({track.mmsi})
                          </div>
                          <div>Type: {track.vessel_type}</div>
                          <div>Speed: <b>{pos.speed_over_ground} kts</b></div>
                          <div>Course: {pos.course_over_ground}°</div>
                          {isSuspect && (
                            <div className="mt-1 text-red-600 font-bold text-[11px] bg-red-50 p-1 rounded border border-red-200">
                              PRIMARY SUSPECT (#{scenario.candidates[0]?.rank})
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

      {/* Map Overlay Legend */}
      <div className="absolute top-4 left-4 z-[1000] bg-tactical-darker/90 backdrop-blur border border-tactical-border rounded-md p-3 text-xs font-mono shadow-xl select-none">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          GEO-INTELLIGENCE LAYERS
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-sm bg-red-500/50 border border-red-500" />
            <span className="text-slate-300">Detected Oil Slick (SAR)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-cyan-400 bg-cyan-500/20" />
            <span className="text-slate-300">Origin Window (Hindcast ±48h)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-sky-400" />
            <span className="text-slate-300">Forecast Drift Path (Shoreline)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500 border border-white" />
            <span className="text-red-400 font-bold">Suspect Vessel Track (AIS)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span className="text-slate-400">Innocent Commercial Traffic</span>
          </div>
        </div>
      </div>
    </div>
  );
};
