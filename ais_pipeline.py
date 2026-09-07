"""
AIS Dark-Vessel & IUU Fishing Risk Pipeline
============================================
Clean, production-oriented rewrite of the original Colab notebook.

What this does
---------------
1. Pulls Global Fishing Watch (GFW) "fishing events" and "AIS gap events"
   for a date range.
2. Flattens the nested JSON into per-event feature rows.
3. Aggregates events per vessel into a feature table.
4. Trains an XGBoost regressor to predict fishing-intensity behaviour,
   with a built-in data-leakage check (with-speed vs without-speed).
5. Detects rendezvous / transshipment candidates (two different vessels
   close in space & time).
6. Runs IsolationForest anomaly detection on vessel behaviour.
7. Scores every AIS gap ("went dark") for IUU risk.
8. Rolls everything into one composite per-vessel risk score.
9. Persists: trained model bundle (.pkl), a SQLite index for fast lookup,
   and a clean CSV "data contract" for downstream teams (e.g. a SAR /
   satellite-tasking team).
10. Serves it all through a FastAPI app for real-time queries.

Usage
-----
    export GFW_API_ACCESS_TOKEN="your_token_here"
    python ais_pipeline.py train --start 2023-11-01 --end 2024-01-31
    python ais_pipeline.py serve --port 8000
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import pickle
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from sklearn.ensemble import IsolationForest
from sklearn.metrics import r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from xgboost import XGBRegressor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ais_pipeline")


# ══════════════════════════════════════════════════════════════════════
#  Configuration
# ══════════════════════════════════════════════════════════════════════

@dataclass
class PipelineConfig:
    start_date: str = "2023-11-01"
    end_date: str = "2024-01-31"
    fishing_dataset: str = "public-global-fishing-events:latest"
    gap_dataset: str = "public-global-gaps-events:latest"
    event_limit: int = 50_000

    # risk-scoring thresholds (tune per patrol-zone / ocean region)
    long_gap_hours: float = 6.0
    very_long_gap_hours: float = 24.0
    offshore_km: float = 200.0
    suspicious_speed_knots: float = 8.0
    large_dark_distance_km: float = 50.0

    # proximity / rendezvous detection
    rendezvous_max_dist_km: float = 2.0
    rendezvous_max_time_hours: float = 1.0

    # anomaly detection
    anomaly_contamination: float = 0.05
    min_events_for_behavior_model: int = 3

    output_dir: Path = field(default_factory=lambda: Path("./artifacts"))

    def __post_init__(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @property
    def model_path(self) -> Path:
        return self.output_dir / "iuu_detection_model.pkl"

    @property
    def db_path(self) -> Path:
        return self.output_dir / "iuu_vessel_index.db"

    @property
    def contract_path(self) -> Path:
        return self.output_dir / "ais_data_contract.csv"


# ══════════════════════════════════════════════════════════════════════
#  1. Data acquisition (Global Fishing Watch API)
# ══════════════════════════════════════════════════════════════════════

class GFWDataFetcher:
    """Thin async wrapper around the GFW API client."""

    def __init__(self, access_token: Optional[str] = None):
        import gfwapiclient as gfw

        token = access_token or os.environ.get("GFW_API_ACCESS_TOKEN")
        if not token:
            raise RuntimeError(
                "Set GFW_API_ACCESS_TOKEN as an environment variable or pass "
                "access_token explicitly."
            )
        self.client = gfw.Client(access_token=token)
        log.info("GFW client initialized")

    async def fetch_events(
        self, dataset: str, start_date: str, end_date: str, limit: int
    ) -> pd.DataFrame:
        result = await self.client.events.get_all_events(
            datasets=[dataset],
            start_date=start_date,
            end_date=end_date,
            limit=limit,
        )
        return result.df()

    async def fetch_fishing_events(self, cfg: PipelineConfig) -> pd.DataFrame:
        log.info("Fetching fishing events %s → %s", cfg.start_date, cfg.end_date)
        df = await self.fetch_events(
            cfg.fishing_dataset, cfg.start_date, cfg.end_date, cfg.event_limit
        )
        log.info("Fetched %d fishing events", len(df))
        return df

    async def fetch_gap_events(self, cfg: PipelineConfig) -> pd.DataFrame:
        log.info("Fetching AIS gap events %s → %s", cfg.start_date, cfg.end_date)
        df = await self.fetch_events(
            cfg.gap_dataset, cfg.start_date, cfg.end_date, cfg.event_limit
        )
        log.info("Fetched %d gap events", len(df))
        return df


# ══════════════════════════════════════════════════════════════════════
#  2. Flattening nested GFW JSON → tabular features
# ══════════════════════════════════════════════════════════════════════

def flatten_fishing_events(df: pd.DataFrame) -> pd.DataFrame:
    """Extract usable per-event features from nested GFW fishing-event rows."""
    rows = []
    for _, row in df.iterrows():
        try:
            pos = row["position"] if isinstance(row["position"], dict) else {}
            vessel = row["vessel"] if isinstance(row["vessel"], dict) else {}
            fishing = row["fishing"] if isinstance(row["fishing"], dict) else {}
            distances = row["distances"] if isinstance(row["distances"], dict) else {}

            start_time, end_time = row["start"], row["end"]
            duration_h = (end_time - start_time).total_seconds() / 3600
            total_distance = fishing.get("total_distance_km", 0)
            intensity = total_distance / duration_h if duration_h > 0 else 0

            rows.append(
                {
                    "event_id": row["id"],
                    "event_type": row["type"],
                    "start_time": start_time,
                    "end_time": end_time,
                    "latitude": pos.get("lat"),
                    "longitude": pos.get("lon"),
                    "vessel_id": vessel.get("id"),
                    "vessel_type": vessel.get("type"),
                    "fishing_distance_km": total_distance,
                    "avg_speed_knots": fishing.get("average_speed_knots", 0),
                    "event_duration_hours": duration_h,
                    "distance_from_shore_km": distances.get(
                        "start_distance_from_shore_km", 0
                    ),
                    "fishing_intensity": intensity,
                }
            )
        except Exception:  # noqa: BLE001 - tolerate malformed rows from the API
            continue
    return pd.DataFrame(rows)


def flatten_gap_events(df: pd.DataFrame) -> pd.DataFrame:
    """Extract usable per-event features from nested GFW AIS-gap rows."""
    rows = []
    for _, row in df.iterrows():
        try:
            vessel = row["vessel"] if isinstance(row["vessel"], dict) else {}
            pos = row["position"] if isinstance(row["position"], dict) else {}
            distances = row["distances"] if isinstance(row["distances"], dict) else {}
            gap_info = row["gap"] if isinstance(row["gap"], dict) else {}

            start_time, end_time = row["start"], row["end"]
            duration_h = (end_time - start_time).total_seconds() / 3600
            gap_hours = gap_info.get("gap_hours", duration_h)
            implied_distance = gap_info.get("implied_distance_km", 0)
            implied_speed = implied_distance / gap_hours if gap_hours > 0 else 0

            rows.append(
                {
                    "gap_id": row["id"],
                    "vessel_id": vessel.get("id"),
                    "vessel_type": vessel.get("type"),
                    "gap_start": start_time,
                    "gap_end": end_time,
                    "gap_duration_hours": duration_h,
                    "implied_distance_km": implied_distance,
                    "implied_speed_knots": implied_speed,
                    "latitude": pos.get("lat"),
                    "longitude": pos.get("lon"),
                    "distance_from_shore_km": distances.get(
                        "start_distance_from_shore_km", 0
                    ),
                }
            )
        except Exception:  # noqa: BLE001
            continue
    return pd.DataFrame(rows)


# ══════════════════════════════════════════════════════════════════════
#  3. Per-vessel feature aggregation
# ══════════════════════════════════════════════════════════════════════

def build_vessel_features(events_flat: pd.DataFrame) -> pd.DataFrame:
    """Aggregate per-event rows into one feature row per vessel."""
    agg = events_flat.groupby("vessel_id").agg(
        {
            "fishing_distance_km": ["mean", "max"],
            "avg_speed_knots": ["mean", "max"],
            "distance_from_shore_km": ["mean", "min", "max"],
            "event_duration_hours": ["mean", "max"],
            "fishing_intensity": ["mean", "max", "std"],
            "vessel_type": "first",
        }
    ).reset_index()
    agg.columns = ["_".join(c).strip("_") for c in agg.columns.values]
    agg = agg.rename(columns={"vessel_id_": "vessel_id"})
    return agg


# ══════════════════════════════════════════════════════════════════════
#  4. Model training with a built-in leakage check
# ══════════════════════════════════════════════════════════════════════

@dataclass
class TrainedModel:
    model: XGBRegressor
    scaler: StandardScaler
    feature_columns: list[str]
    r2_with_speed: float
    r2_without_speed: float
    used_no_speed: bool


def train_intensity_model(vessel_features: pd.DataFrame) -> TrainedModel:
    """
    Train an XGBoost regressor for fishing intensity, then run a leakage
    test: if the target's own definition (distance / time) is trivially
    reconstructable from a speed feature, drop that feature so the model
    learns actual behaviour instead of algebra.
    """
    X = vessel_features.fillna(0).copy()
    X["vessel_type_encoded"] = LabelEncoder().fit_transform(X["vessel_type_first"])

    exclude = {
        "vessel_id",
        "vessel_type_first",
        "vessel_type_encoded",
        "fishing_intensity_mean",
        "fishing_intensity_max",
        "fishing_intensity_std",
    }
    feature_cols = [
        c for c in X.columns if c not in exclude and "_std" not in c and "_count" not in c
    ]
    y = X["fishing_intensity_mean"]

    X_train, X_test, y_train, y_test = train_test_split(
        X[feature_cols], y, test_size=0.2, random_state=42
    )

    def _fit(cols: list[str]) -> tuple[XGBRegressor, StandardScaler, float]:
        scaler = StandardScaler()
        Xtr = scaler.fit_transform(X_train[cols])
        Xte = scaler.transform(X_test[cols])
        model = XGBRegressor(
            n_estimators=150, learning_rate=0.05, max_depth=7,
            random_state=42, verbosity=0,
        )
        model.fit(Xtr, y_train)
        r2 = r2_score(y_test, model.predict(Xte))
        return model, scaler, r2

    log.info("Leakage test: training WITH vs WITHOUT speed features")
    model_with, scaler_with, r2_with = _fit(feature_cols)
    cols_no_speed = [c for c in feature_cols if "speed" not in c.lower()]
    model_without, scaler_without, r2_without = _fit(cols_no_speed)

    log.info("R² with speed = %.4f | without speed = %.4f", r2_with, r2_without)

    if r2_without < 0.5:
        log.warning(
            "Leakage detected (speed carries most of the signal because "
            "intensity = distance / time uses speed implicitly). "
            "Using the NO-SPEED model for real predictions."
        )
        return TrainedModel(model_without, scaler_without, cols_no_speed, r2_with, r2_without, True)

    log.info("Leakage minimal — using the full-feature model.")
    return TrainedModel(model_with, scaler_with, feature_cols, r2_with, r2_without, False)


# ══════════════════════════════════════════════════════════════════════
#  5. Rendezvous / transshipment proximity detection
# ══════════════════════════════════════════════════════════════════════

def detect_proximity_events(
    events_flat: pd.DataFrame, cfg: PipelineConfig
) -> pd.DataFrame:
    """Flag pairs of *different* vessels close in space and time —
    a classic transshipment / rendezvous signature."""
    df = events_flat.dropna(subset=["latitude", "longitude"]).reset_index(drop=True)
    if df.empty:
        return pd.DataFrame(
            columns=["vessel_1", "vessel_2", "event_1", "event_2", "time_diff_hours", "lat", "lon"]
        )

    df["start_ts"] = df["start_time"].astype("int64") // 10**9
    coords = np.radians(df[["latitude", "longitude"]].values)
    tree = cKDTree(coords)
    radius_rad = cfg.rendezvous_max_dist_km / 6371.0  # great-circle chord approx

    flagged = []
    for i, j in tree.query_pairs(r=radius_rad):
        if df.at[i, "vessel_id"] == df.at[j, "vessel_id"]:
            continue
        dt_hours = abs(df.at[i, "start_ts"] - df.at[j, "start_ts"]) / 3600
        if dt_hours <= cfg.rendezvous_max_time_hours:
            flagged.append(
                {
                    "vessel_1": df.at[i, "vessel_id"],
                    "vessel_2": df.at[j, "vessel_id"],
                    "event_1": df.at[i, "event_id"],
                    "event_2": df.at[j, "event_id"],
                    "time_diff_hours": dt_hours,
                    "lat": df.at[i, "latitude"],
                    "lon": df.at[i, "longitude"],
                }
            )
    return pd.DataFrame(flagged)


# ══════════════════════════════════════════════════════════════════════
#  6. Behavioural anomaly detection
# ══════════════════════════════════════════════════════════════════════

def detect_behavioral_anomalies(
    events_flat: pd.DataFrame, cfg: PipelineConfig
) -> pd.DataFrame:
    """IsolationForest over per-vessel behaviour stats (only for vessels
    with enough events to have a meaningful behavioural profile)."""
    counts = events_flat.groupby("vessel_id").size()
    eligible = counts[counts >= cfg.min_events_for_behavior_model].index
    subset = events_flat[events_flat["vessel_id"].isin(eligible)]

    if subset.empty:
        return pd.DataFrame(columns=["vessel_id", "is_anomalous"])

    feats = subset.groupby("vessel_id").agg(
        {
            "fishing_intensity": ["mean", "std", "max"],
            "distance_from_shore_km": ["mean", "std"],
            "avg_speed_knots": ["mean", "std"],
            "event_duration_hours": ["mean", "std"],
        }
    )
    feats.columns = ["_".join(c) for c in feats.columns]
    feats = feats.fillna(0).reset_index()

    iso = IsolationForest(contamination=cfg.anomaly_contamination, random_state=42)
    preds = iso.fit_predict(feats.drop(columns=["vessel_id"]))
    feats["is_anomalous"] = preds == -1
    return feats[["vessel_id", "is_anomalous"]]


# ══════════════════════════════════════════════════════════════════════
#  7. AIS-gap ("went dark") risk scoring
# ══════════════════════════════════════════════════════════════════════

def score_gap_risk(
    gaps_flat: pd.DataFrame, proximity_df: pd.DataFrame, cfg: PipelineConfig
) -> pd.DataFrame:
    """
    Heuristic 0-100 risk score per AIS gap:
      +30 gap > 6h, +30 more if > 24h        → dark for a suspiciously long time
      +20 offshore (>200km from shore)        → far from legitimate coastal transit
      +25 implied speed > 8 knots             → was clearly moving while dark
      +25 implied distance moved > 50km       → covered real distance while dark
      +15 near another vessel during the gap  → possible transshipment
    """
    g = gaps_flat.copy()
    g["risk_score"] = 0.0

    g.loc[g["gap_duration_hours"] > cfg.long_gap_hours, "risk_score"] += 30
    g.loc[g["gap_duration_hours"] > cfg.very_long_gap_hours, "risk_score"] += 30
    g.loc[g["distance_from_shore_km"] > cfg.offshore_km, "risk_score"] += 20
    g.loc[g["implied_speed_knots"] > cfg.suspicious_speed_knots, "risk_score"] += 25
    g.loc[g["implied_distance_km"] > cfg.large_dark_distance_km, "risk_score"] += 25
    g["risk_score"] = g["risk_score"].clip(0, 100)

    if proximity_df is not None and not proximity_df.empty:
        gap_vessels = set(g["vessel_id"])
        rel = proximity_df[
            proximity_df["vessel_1"].isin(gap_vessels) | proximity_df["vessel_2"].isin(gap_vessels)
        ]
        counts = (
            rel.groupby("vessel_1").size().reindex(gap_vessels, fill_value=0)
            + rel.groupby("vessel_2").size().reindex(gap_vessels, fill_value=0)
        ).fillna(0)
        g["proximity_events_during_period"] = g["vessel_id"].map(counts).fillna(0).astype(int)
        g.loc[g["proximity_events_during_period"] > 0, "risk_score"] += 15
        g["risk_score"] = g["risk_score"].clip(0, 100)
    else:
        g["proximity_events_during_period"] = 0

    return g


# ══════════════════════════════════════════════════════════════════════
#  8. Composite per-vessel risk index
# ══════════════════════════════════════════════════════════════════════

def build_vessel_risk_index(
    gaps_scored: pd.DataFrame,
    anomaly_flags: pd.DataFrame,
    proximity_df: pd.DataFrame,
) -> pd.DataFrame:
    risk = (
        gaps_scored.groupby("vessel_id")
        .agg(
            {
                "risk_score": ["mean", "max", "count"],
                "gap_duration_hours": "sum",
                "implied_distance_km": "sum",
                "distance_from_shore_km": "mean",
            }
        )
        .reset_index()
    )
    risk.columns = ["_".join(c).strip("_") for c in risk.columns.values]
    risk = risk.rename(columns={"vessel_id_": "vessel_id"})

    anomaly_map = anomaly_flags.set_index("vessel_id")["is_anomalous"].to_dict()
    risk["is_behaviorally_anomalous"] = risk["vessel_id"].map(anomaly_map).fillna(False)

    if not proximity_df.empty:
        prox_counts = (
            proximity_df.groupby("vessel_1").size().rename("v1")
            + proximity_df.groupby("vessel_2").size().rename("v2")
        ).fillna(0)
        # combine independently counted sides, then map
        prox_counts = pd.concat(
            [
                proximity_df.groupby("vessel_1").size(),
                proximity_df.groupby("vessel_2").size(),
            ]
        ).groupby(level=0).sum()
        risk["proximity_encounter_count"] = risk["vessel_id"].map(prox_counts).fillna(0).astype(int)
    else:
        risk["proximity_encounter_count"] = 0

    risk["composite_risk"] = (
        risk["risk_score_mean"] * 0.5
        + risk["is_behaviorally_anomalous"].astype(int) * 25
        + risk["proximity_encounter_count"].clip(0, 10) * 2.5
    ).clip(0, 100)

    return risk.sort_values("composite_risk", ascending=False).reset_index(drop=True)


# ══════════════════════════════════════════════════════════════════════
#  9. Persistence: model bundle, SQLite index, SAR data contract
# ══════════════════════════════════════════════════════════════════════

def persist_model(trained: TrainedModel, cfg: PipelineConfig) -> None:
    bundle = {
        "xgb_model": trained.model,
        "scaler": trained.scaler,
        "feature_columns": trained.feature_columns,
        "feature_importance": pd.Series(
            trained.model.feature_importances_, index=trained.feature_columns
        ).sort_values(ascending=False),
        "r2_with_speed": trained.r2_with_speed,
        "r2_without_speed": trained.r2_without_speed,
    }
    with open(cfg.model_path, "wb") as f:
        pickle.dump(bundle, f)
    log.info("Model bundle saved → %s", cfg.model_path)


def persist_vessel_index(
    vessel_risk: pd.DataFrame, gaps_scored: pd.DataFrame, cfg: PipelineConfig
) -> None:
    conn = sqlite3.connect(cfg.db_path)
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS vessel_risk")
    cur.execute(
        """
        CREATE TABLE vessel_risk (
            vessel_id TEXT PRIMARY KEY,
            composite_risk REAL,
            gap_risk_mean REAL,
            behavioral_anomaly INTEGER,
            proximity_count INTEGER,
            total_gap_hours REAL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.executemany(
        """
        INSERT OR REPLACE INTO vessel_risk
        (vessel_id, composite_risk, gap_risk_mean, behavioral_anomaly,
         proximity_count, total_gap_hours)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        vessel_risk[
            [
                "vessel_id", "composite_risk", "risk_score_mean",
                "is_behaviorally_anomalous", "proximity_encounter_count",
                "gap_duration_hours_sum",
            ]
        ].itertuples(index=False, name=None),
    )

    cur.execute("DROP TABLE IF EXISTS gaps")
    cur.execute(
        """
        CREATE TABLE gaps (
            gap_id TEXT PRIMARY KEY,
            vessel_id TEXT,
            gap_start TEXT,
            gap_end TEXT,
            duration_hours REAL,
            distance_from_shore_km REAL,
            risk_score REAL,
            FOREIGN KEY (vessel_id) REFERENCES vessel_risk(vessel_id)
        )
        """
    )
    cur.executemany(
        """
        INSERT OR REPLACE INTO gaps VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            (
                row.gap_id, row.vessel_id, str(row.gap_start), str(row.gap_end),
                row.gap_duration_hours, row.distance_from_shore_km, row.risk_score,
            )
            for row in gaps_scored.itertuples(index=False)
        ),
    )

    conn.commit()
    conn.close()
    log.info(
        "SQLite index written → %s (%d vessels, %d gaps)",
        cfg.db_path, len(vessel_risk), len(gaps_scored),
    )


def export_sar_data_contract(
    vessel_risk: pd.DataFrame, gaps_scored: pd.DataFrame, cfg: PipelineConfig
) -> pd.DataFrame:
    """
    Produce the clean, minimal handoff file a Search-and-Rescue / satellite-
    tasking team needs: who is high-risk, where they were last seen, and when.
    This is the "data contract" — a stable schema other teams can build on.
    """
    last_pos = (
        gaps_scored.sort_values("gap_end")
        .groupby("vessel_id")
        .last()[["latitude", "longitude", "gap_end"]]
        .reset_index()
        .rename(columns={
            "latitude": "last_known_lat",
            "longitude": "last_known_lon",
            "gap_end": "last_activity_timestamp_utc",
        })
    )

    contract = vessel_risk.merge(last_pos, on="vessel_id", how="left")
    contract = contract[
        [
            "vessel_id", "composite_risk", "risk_score_mean",
            "is_behaviorally_anomalous", "proximity_encounter_count",
            "last_known_lat", "last_known_lon", "last_activity_timestamp_utc",
        ]
    ].rename(
        columns={
            "composite_risk": "composite_risk_score",
            "risk_score_mean": "avg_gap_risk_score",
            "is_behaviorally_anomalous": "behavioral_anomaly_flag",
            "proximity_encounter_count": "proximity_encounters",
        }
    )
    contract["last_activity_timestamp_utc"] = pd.to_datetime(
        contract["last_activity_timestamp_utc"]
    ).dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    contract.to_csv(cfg.contract_path, index=False)
    log.info("SAR data contract exported → %s", cfg.contract_path)
    return contract


# ══════════════════════════════════════════════════════════════════════
#  10. End-to-end pipeline orchestration
# ══════════════════════════════════════════════════════════════════════

async def run_training_pipeline(cfg: PipelineConfig, access_token: Optional[str] = None) -> None:
    fetcher = GFWDataFetcher(access_token)

    fishing_raw = await fetcher.fetch_fishing_events(cfg)
    gaps_raw = await fetcher.fetch_gap_events(cfg)

    log.info("Flattening events...")
    fishing_flat = flatten_fishing_events(fishing_raw)
    gaps_flat = flatten_gap_events(gaps_raw)

    log.info("Aggregating per-vessel features...")
    vessel_features = build_vessel_features(fishing_flat)

    log.info("Training intensity model (with leakage check)...")
    trained = train_intensity_model(vessel_features)

    log.info("Detecting rendezvous / transshipment proximity events...")
    proximity_df = detect_proximity_events(fishing_flat, cfg)

    log.info("Running behavioural anomaly detection...")
    anomaly_flags = detect_behavioral_anomalies(fishing_flat, cfg)

    log.info("Scoring AIS gaps for dark-time risk...")
    gaps_scored = score_gap_risk(gaps_flat, proximity_df, cfg)

    log.info("Building composite vessel risk index...")
    vessel_risk = build_vessel_risk_index(gaps_scored, anomaly_flags, proximity_df)

    persist_model(trained, cfg)
    persist_vessel_index(vessel_risk, gaps_scored, cfg)
    export_sar_data_contract(vessel_risk, gaps_scored, cfg)

    gaps_scored.to_csv(cfg.output_dir / "gaps_scored.csv", index=False)
    vessel_risk.to_csv(cfg.output_dir / "vessel_risk_profiles.csv", index=False)

    log.info("=" * 60)
    log.info("PIPELINE COMPLETE")
    log.info("Vessels scored     : %d", len(vessel_risk))
    log.info("Gaps scored        : %d", len(gaps_scored))
    log.info("High-risk vessels  : %d", (vessel_risk["composite_risk"] >= 70).sum())
    log.info("Anomalous vessels  : %d", vessel_risk["is_behaviorally_anomalous"].sum())
    log.info("Model R² (used)    : %.4f", (
        trained.r2_without_speed if trained.used_no_speed else trained.r2_with_speed
    ))
    log.info("=" * 60)


# ══════════════════════════════════════════════════════════════════════
#  11. FastAPI serving layer
# ══════════════════════════════════════════════════════════════════════

def create_app(cfg: PipelineConfig):
    """Build the FastAPI app lazily so `train` mode never needs fastapi installed."""
    from fastapi import FastAPI, HTTPException, Query
    from pydantic import BaseModel

    app = FastAPI(
        title="AIS Dark-Vessel / IUU Detection API",
        version="1.0",
        description="Real-time vessel risk scoring & anomaly lookup.",
    )

    with open(cfg.model_path, "rb") as f:
        bundle = pickle.load(f)
    xgb_model, scaler, feature_columns = (
        bundle["xgb_model"], bundle["scaler"], bundle["feature_columns"]
    )

    def get_db() -> sqlite3.Connection:
        conn = sqlite3.connect(cfg.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    class RiskResponse(BaseModel):
        vessel_id: str
        composite_risk: float
        gap_risk_mean: float
        behavioral_anomaly: bool
        proximity_encounters: int
        total_gap_hours: float
        status: str

    class VesselFeatures(BaseModel):
        values: dict[str, float]  # keyed by feature_columns

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/vessel/{vessel_id}", response_model=RiskResponse)
    async def get_vessel_risk(vessel_id: str):
        conn = get_db()
        row = conn.execute(
            "SELECT * FROM vessel_risk WHERE vessel_id = ?", (vessel_id,)
        ).fetchone()
        conn.close()
        if not row:
            raise HTTPException(404, f"Vessel {vessel_id} not found")
        risk = row["composite_risk"]
        status = "HIGH_RISK" if risk >= 70 else "MEDIUM_RISK" if risk >= 50 else "LOW_RISK"
        return RiskResponse(
            vessel_id=row["vessel_id"],
            composite_risk=risk,
            gap_risk_mean=row["gap_risk_mean"],
            behavioral_anomaly=bool(row["behavioral_anomaly"]),
            proximity_encounters=row["proximity_count"],
            total_gap_hours=row["total_gap_hours"],
            status=status,
        )

    @app.post("/predict-intensity")
    async def predict_intensity(payload: VesselFeatures):
        try:
            x = np.array([[payload.values[c] for c in feature_columns]])
        except KeyError as e:
            raise HTTPException(400, f"Missing feature: {e}")
        x_scaled = scaler.transform(x)
        intensity = float(xgb_model.predict(x_scaled)[0])
        category = "HIGH" if intensity > 5 else "MEDIUM" if intensity > 2 else "LOW"
        return {"predicted_intensity_km_hr": intensity, "intensity_category": category}

    @app.get("/gaps/{vessel_id}")
    async def get_vessel_gaps(vessel_id: str, min_risk: float = Query(70, ge=0, le=100)):
        conn = get_db()
        rows = conn.execute(
            """SELECT gap_id, gap_start, gap_end, duration_hours,
                      distance_from_shore_km, risk_score
               FROM gaps WHERE vessel_id = ? AND risk_score >= ?
               ORDER BY risk_score DESC""",
            (vessel_id, min_risk),
        ).fetchall()
        conn.close()
        return {"vessel_id": vessel_id, "gaps_count": len(rows), "high_risk_gaps": [dict(r) for r in rows]}

    @app.get("/top-risk-vessels")
    async def top_risk_vessels(limit: int = Query(20, ge=1, le=100)):
        conn = get_db()
        rows = conn.execute(
            """SELECT vessel_id, composite_risk, behavioral_anomaly,
                      proximity_count, gap_risk_mean
               FROM vessel_risk ORDER BY composite_risk DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        conn.close()
        return {"top_vessels": [dict(r) for r in rows]}

    @app.get("/risk-distribution")
    async def risk_distribution():
        conn = get_db()
        row = conn.execute(
            """SELECT COUNT(*) total,
                      SUM(CASE WHEN composite_risk >= 70 THEN 1 ELSE 0 END) high_risk,
                      SUM(CASE WHEN composite_risk >= 50 AND composite_risk < 70 THEN 1 ELSE 0 END) medium_risk,
                      SUM(CASE WHEN composite_risk < 50 THEN 1 ELSE 0 END) low_risk,
                      SUM(CASE WHEN behavioral_anomaly = 1 THEN 1 ELSE 0 END) anomalous,
                      AVG(composite_risk) avg_risk
               FROM vessel_risk"""
        ).fetchone()
        conn.close()
        return dict(row)

    return app


# ══════════════════════════════════════════════════════════════════════
#  CLI entry point
# ══════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(description="AIS dark-vessel / IUU risk pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    train_p = sub.add_parser("train", help="Run the full data → model → index pipeline")
    train_p.add_argument("--start", default="2023-11-01")
    train_p.add_argument("--end", default="2024-01-31")
    train_p.add_argument("--output-dir", default="./artifacts")

    serve_p = sub.add_parser("serve", help="Serve the trained model via FastAPI")
    serve_p.add_argument("--output-dir", default="./artifacts")
    serve_p.add_argument("--host", default="0.0.0.0")
    serve_p.add_argument("--port", type=int, default=8000)

    args = parser.parse_args()

    if args.command == "train":
        cfg = PipelineConfig(
            start_date=args.start, end_date=args.end, output_dir=Path(args.output_dir)
        )
        asyncio.run(run_training_pipeline(cfg))

    elif args.command == "serve":
        import uvicorn
        cfg = PipelineConfig(output_dir=Path(args.output_dir))
        app = create_app(cfg)
        uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
