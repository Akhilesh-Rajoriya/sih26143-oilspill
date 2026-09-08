"""
AIS Vessel Scoring & Attribution Engine.
Calculates multi-factor attribution scores for candidate vessels against
an estimated spill OriginWindow:
1. Spatial Proximity (0.35)
2. Temporal Coincidence (0.25)
3. Trajectory Intercept (0.20)
4. Speed/Behavioral Anomaly (0.10)
5. AIS Transponder Gap Risk (0.10)
"""
from datetime import datetime
from typing import List, Optional, Tuple
import numpy as np
import pandas as pd

from schemas import OriginWindow, AISTrack, AISPosition, VesselScore
from drift_model import haversine_km
from app.config import AIS_WEIGHTS


def compute_proximity_score(min_distance_km: float, search_radius_km: float) -> float:
    """Returns 1.0 at origin center, decaying linearly to 0.0 at search_radius_km."""
    if min_distance_km >= search_radius_km:
        return 0.0
    return round(max(0.0, 1.0 - (min_distance_km / search_radius_km)), 3)


def compute_temporal_score(point_time: datetime, origin: OriginWindow) -> float:
    """Returns 1.0 if inside [time_start, time_end], decaying outside."""
    start = origin.time_start if isinstance(origin.time_start, datetime) else datetime.fromisoformat(str(origin.time_start))
    end = origin.time_end if isinstance(origin.time_end, datetime) else datetime.fromisoformat(str(origin.time_end))

    if start <= point_time <= end:
        return 1.0

    window_hours = max((end - start).total_seconds() / 3600.0, 1.0)
    gap_hours = (start - point_time).total_seconds() / 3600.0 if point_time < start else (point_time - end).total_seconds() / 3600.0
    decay = max(0.0, 1.0 - (gap_hours / (window_hours * 3.0)))
    return round(decay, 3)


def detect_track_anomalies(track: AISTrack, origin: OriginWindow) -> Tuple[float, float, List[str]]:
    """
    Analyzes vessel trajectory for behavioral anomalies:
    - Speed drop near origin (discharge signature)
    - AIS transponder gaps (turning off transponder)
    Returns: (anomaly_score, gap_risk_score, list_of_flags)
    """
    flags: List[str] = []
    positions = track.positions
    if not positions:
        return 0.0, 0.0, flags

    # 1. Transponder gap analysis
    max_gap_hours = 0.0
    for i in range(len(positions) - 1):
        dt = (positions[i+1].timestamp - positions[i].timestamp).total_seconds() / 3600.0
        if dt > max_gap_hours:
            max_gap_hours = dt

    gap_risk = 0.0
    if max_gap_hours >= 1.5:
        # Scale gap risk up to 1.0 for gaps >= 6h
        gap_risk = min(1.0, max_gap_hours / 6.0)
        flags.append(f"AIS transponder silence: {max_gap_hours:.1f}h gap detected")

    # 2. Speed drop analysis near origin
    anomaly_score = 0.0
    distances = [haversine_km(origin.center_lat, origin.center_lon, p.lat, p.lon) for p in positions]
    speeds = [p.speed_over_ground for p in positions]

    min_dist = min(distances)
    if min_dist <= max(origin.radius_km * 2.0, 15.0) and len(speeds) >= 3:
        max_speed = max(speeds)
        min_speed_near = min(s for s, d in zip(speeds, distances) if d <= max(origin.radius_km * 2.0, 15.0))
        if max_speed >= 10.0 and min_speed_near <= 4.0:
            anomaly_score = 0.95
            flags.append(f"Sudden deceleration near origin ({max_speed:.1f} kts -> {min_speed_near:.1f} kts, potential discharge)")
        elif min_speed_near <= 3.0:
            anomaly_score = 0.50
            flags.append(f"Low speed loitering near origin ({min_speed_near:.1f} kts)")

    final_anomaly = round(max(anomaly_score, gap_risk * 0.5), 3)
    return final_anomaly, round(gap_risk, 3), flags


def score_vessel_track(track: AISTrack, origin: OriginWindow, search_radius_km: float = 40.0) -> VesselScore:
    """Scores a single vessel track against the spill OriginWindow."""
    if not track.positions:
        return VesselScore(
            mmsi=track.mmsi,
            vessel_name=track.vessel_name,
            vessel_type=track.vessel_type,
            proximity_score=0.0,
            trajectory_score=0.0,
            anomaly_score=0.0,
            total_score=0.0,
            rank=0,
            anomaly_flags=["No position reports available"],
        )

    # 1. Distances and Proximity
    distances = [haversine_km(origin.center_lat, origin.center_lon, p.lat, p.lon) for p in track.positions]
    min_dist = min(distances)
    effective_radius = max(search_radius_km, origin.radius_km * 3.0)
    prox_score = compute_proximity_score(min_dist, effective_radius)

    # 2. Temporal Score
    temporal_scores = [compute_temporal_score(p.timestamp, origin) for p in track.positions]
    # Weight temporal score higher for positions closer to origin
    weighted_temporal = []
    for t_score, dist in zip(temporal_scores, distances):
        dist_weight = max(0.1, 1.0 - (dist / effective_radius))
        weighted_temporal.append(t_score * dist_weight)
    temp_score = round(max(weighted_temporal, default=0.0), 3)

    # 3. Trajectory / Intercept Score
    # Check if ship passed within origin radius
    if min_dist <= origin.radius_km:
        traj_score = 0.95
    elif min_dist <= origin.radius_km * 2.0:
        traj_score = 0.75
    elif min_dist <= effective_radius * 0.6:
        traj_score = 0.45
    else:
        traj_score = 0.15

    # 4. Anomaly & Gap Risk
    anomaly_score, gap_risk, flags = detect_track_anomalies(track, origin)

    # 5. Composite Score
    w_prox = AIS_WEIGHTS.get("proximity", 0.35)
    w_temp = AIS_WEIGHTS.get("temporal", 0.25)
    w_track = AIS_WEIGHTS.get("track", 0.20)
    w_anom = AIS_WEIGHTS.get("anomaly", 0.10)
    w_gap = AIS_WEIGHTS.get("gap_risk", 0.10)

    total = (
        w_prox * prox_score
        + w_temp * temp_score
        + w_track * traj_score
        + w_anom * anomaly_score
        + w_gap * gap_risk
    )
    total_score = round(float(np.clip(total, 0.0, 1.0)), 3)

    return VesselScore(
        mmsi=track.mmsi,
        vessel_name=track.vessel_name,
        vessel_type=track.vessel_type,
        proximity_score=prox_score,
        trajectory_score=traj_score,
        anomaly_score=round(max(anomaly_score, gap_risk), 3),
        total_score=total_score,
        rank=0,
        anomaly_flags=flags,
    )


def score_candidate_tracks(tracks: List[AISTrack], origin: OriginWindow, search_radius_km: float = 40.0) -> List[VesselScore]:
    """Scores and ranks all candidate vessel tracks against an OriginWindow."""
    scores = [score_vessel_track(t, origin, search_radius_km) for t in tracks]
    scores.sort(key=lambda s: s.total_score, reverse=True)
    for idx, s in enumerate(scores):
        s.rank = idx + 1
    return scores

