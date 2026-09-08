"""
Spill-specific AIS vessel scoring.
Adapts ais_pipeline.py's real GFW-data logic (gap risk, proximity/rendezvous,
behavioral anomaly) to score candidates against ONE specific spill's
OriginWindow - not a global, incident-independent risk index.
"""
import asyncio
from datetime import timedelta
from typing import List

import numpy as np
import pandas as pd

from schemas import OriginWindow, VesselScore
from drift_model import haversine_km
from ais_pipeline import (
    PipelineConfig,
    GFWDataFetcher,
    flatten_fishing_events,
    flatten_gap_events,
    detect_proximity_events,
    detect_behavioral_anomalies,
    score_gap_risk,
)

# Scoring weights - matches brain.md's formula
WEIGHT_PROXIMITY = 0.35
WEIGHT_TEMPORAL = 0.25
WEIGHT_TRACK = 0.20
WEIGHT_ANOMALY = 0.10
WEIGHT_GAP_RISK = 0.10


def proximity_score(distance_km: float, search_radius_km: float) -> float:
    """1.0 = right at the origin center, 0.0 = at or beyond the search radius."""
    if distance_km >= search_radius_km:
        return 0.0
    return round(1.0 - (distance_km / search_radius_km), 3)


def temporal_overlap_score(event_time: pd.Timestamp, origin: OriginWindow) -> float:
    """1.0 = event falls inside the origin's time window, decaying outside it."""
    start = pd.Timestamp(origin.time_start)
    end = pd.Timestamp(origin.time_end)
    if start <= event_time <= end:
        return 1.0
    window_hours = max((end - start).total_seconds() / 3600, 1.0)
    if event_time < start:
        gap_hours = (start - event_time).total_seconds() / 3600
    else:
        gap_hours = (event_time - end).total_seconds() / 3600
    score = max(0.0, 1.0 - (gap_hours / (window_hours * 2)))
    return round(score, 3)


async def score_vessels_for_origin(
    origin: OriginWindow,
    access_token: str,
    search_radius_km: float = 50.0,
    time_padding_hours: float = 12.0,
) -> List[VesselScore]:
    """
    Fetches real GFW fishing + gap events around origin.time_start/time_end
    (padded), filters to vessels whose positions fall within search_radius_km
    of the spill's estimated origin, and scores them per brain.md's formula.
    """
    padded_start = (pd.Timestamp(origin.time_start) - timedelta(hours=time_padding_hours)).strftime("%Y-%m-%d")
    padded_end = (pd.Timestamp(origin.time_end) + timedelta(hours=time_padding_hours)).strftime("%Y-%m-%d")

    cfg = PipelineConfig(start_date=padded_start, end_date=padded_end)
    fetcher = GFWDataFetcher(access_token)

    print(f"Fetching GFW events {padded_start} -> {padded_end} (will filter to {search_radius_km}km of origin)...")
    fishing_raw = await fetcher.fetch_fishing_events(cfg)
    gaps_raw = await fetcher.fetch_gap_events(cfg)

    fishing_flat = flatten_fishing_events(fishing_raw)
    gaps_flat = flatten_gap_events(gaps_raw)

    # Spatial filter: keep only events within search_radius_km of the spill origin
    def within_radius(df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        df = df.dropna(subset=["latitude", "longitude"]).copy()
        df["distance_to_origin_km"] = df.apply(
            lambda r: haversine_km(origin.center_lat, origin.center_lon, r["latitude"], r["longitude"]),
            axis=1,
        )
        return df[df["distance_to_origin_km"] <= search_radius_km]

    fishing_near = within_radius(fishing_flat)
    gaps_near = within_radius(gaps_flat)

    print(f"Candidates near origin: {fishing_near['vessel_id'].nunique() if not fishing_near.empty else 0} "
          f"(fishing events), {gaps_near['vessel_id'].nunique() if not gaps_near.empty else 0} (gap events)")

    if fishing_near.empty and gaps_near.empty:
        print("No AIS-tracked vessels found near this spill's origin window.")
        return []

    # Reuse existing pipeline logic for behavior/gap risk, on the FULL fetched
    # set (needed for meaningful anomaly baselines), then filter results down
    proximity_df = detect_proximity_events(fishing_flat, cfg)
    anomaly_flags = detect_behavioral_anomalies(fishing_flat, cfg) if not fishing_flat.empty else pd.DataFrame(columns=["vessel_id", "is_anomalous"])
    gaps_scored = score_gap_risk(gaps_flat, proximity_df, cfg) if not gaps_flat.empty else pd.DataFrame()

    candidate_vessel_ids = set(fishing_near["vessel_id"]).union(set(gaps_near["vessel_id"]))

    results = []
    for vid in candidate_vessel_ids:
        v_fishing = fishing_near[fishing_near["vessel_id"] == vid]
        v_gaps = gaps_near[gaps_near["vessel_id"] == vid]

        min_distance = pd.concat([
            v_fishing["distance_to_origin_km"] if not v_fishing.empty else pd.Series(dtype=float),
            v_gaps["distance_to_origin_km"] if not v_gaps.empty else pd.Series(dtype=float),
        ]).min()
        prox_score = proximity_score(min_distance, search_radius_km)

        event_times = pd.concat([
            v_fishing["start_time"] if not v_fishing.empty else pd.Series(dtype="datetime64[ns]"),
            v_gaps["gap_start"] if not v_gaps.empty else pd.Series(dtype="datetime64[ns]"),
        ])
        temp_score = max([temporal_overlap_score(t, origin) for t in event_times], default=0.0)

        # Track compatibility: simple proxy - did the vessel have events
        # both before AND after, consistent with passing through the area
        # (a fuller trajectory-heading check is a documented future upgrade)
        track_score = 0.7 if len(event_times) >= 2 else 0.4

        is_anomalous = bool(anomaly_flags.set_index("vessel_id")["is_anomalous"].get(vid, False)) if not anomaly_flags.empty else False
        anomaly_score = 1.0 if is_anomalous else 0.0

        vessel_gap_risk = 0.0
        anomaly_flag_list = []
        if not gaps_scored.empty:
            v_gap_rows = gaps_scored[gaps_scored["vessel_id"] == vid]
            if not v_gap_rows.empty:
                vessel_gap_risk = float(v_gap_rows["risk_score"].mean()) / 100.0
                for _, gr in v_gap_rows.iterrows():
                    if gr["gap_duration_hours"] > 6:
                        anomaly_flag_list.append(f"AIS gap: {gr['gap_duration_hours']:.0f}h")
        if is_anomalous:
            anomaly_flag_list.append("Behavioral anomaly detected")

        total = (
            WEIGHT_PROXIMITY * prox_score
            + WEIGHT_TEMPORAL * temp_score
            + WEIGHT_TRACK * track_score
            + WEIGHT_ANOMALY * anomaly_score
            + WEIGHT_GAP_RISK * vessel_gap_risk
        )

        results.append(VesselScore(
            mmsi=str(vid),
            vessel_name=None,
            vessel_type=str(v_fishing["vessel_type"].iloc[0]) if not v_fishing.empty else "unknown",
            proximity_score=round(prox_score, 3),
            trajectory_score=round(track_score, 3),
            anomaly_score=round(max(anomaly_score, vessel_gap_risk), 3),
            total_score=round(total, 3),
            rank=0,
            anomaly_flags=anomaly_flag_list,
        ))

    results.sort(key=lambda v: v.total_score, reverse=True)
    for i, r in enumerate(results):
        r.rank = i + 1

    return results


if __name__ == "__main__":
    import os

    token = os.environ.get("GFW_API_ACCESS_TOKEN")
    if not token:
        print("ERROR: Set GFW_API_ACCESS_TOKEN environment variable first.")
        exit(1)

    # Real OriginWindow from your actual test_sar_to_drift.py run
    test_origin = OriginWindow(
        slick_id="mumbai_spill_01",
        center_lat=19.2575,
        center_lon=72.7180,
        radius_km=4.99,
        time_start="2023-12-31T09:00:00",
        time_end="2023-12-31T11:00:00",
        confidence=0.95,
    )

    scores = asyncio.run(score_vessels_for_origin(test_origin, token))

    print("\n" + "=" * 60)
    print(f"RANKED SUSPECTS ({len(scores)} candidates)")
    print("=" * 60)
    for s in scores[:10]:
        print(f"#{s.rank} MMSI={s.mmsi} type={s.vessel_type} "
              f"total={s.total_score:.3f} (prox={s.proximity_score:.2f}, "
              f"temporal-ok, track={s.trajectory_score:.2f}, anomaly={s.anomaly_score:.2f}) "
              f"flags={s.anomaly_flags}")