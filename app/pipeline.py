"""
Master Pipeline Orchestrator for SIH26143.
Chains end-to-end execution:
SAR Detection -> Lagrangian Drift Modeling (Hindcast + Forecast) -> AIS Attribution
"""
import gc
import io
import os
import time
from datetime import datetime
from typing import Optional, Union, Tuple, List
import numpy as np

try:
    import rasterio
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False

from schemas import SlickDetection, OriginWindow, ForecastPath, VesselScore, AISTrack, ScenarioResult
from app.config import (
    MODEL_WEIGHTS_PATH,
    DEFAULT_WIND_NC,
    DEFAULT_CURRENTS_NC,
    DEFAULT_ROI,
    RegionOfInterest,
)
from app.sar.detector import SARSpillDetector
from drift_model import load_vector_field, run_hindcast, run_forecast, AdaptiveVectorField
from app.ais.synthetic import generate_synthetic_coastal_ais
from app.ais.scoring import score_candidate_tracks


def run_pipeline(
    sar_source: Union[str, np.ndarray, bytes],
    bbox: Optional[Tuple[float, float, float, float]] = None,
    detection_time: Optional[datetime] = None,
    slick_id: Optional[str] = None,
    wind_nc: Optional[str] = None,
    currents_nc: Optional[str] = None,
    ais_mode: str = "synthetic",
    gfw_token: Optional[str] = None,
) -> ScenarioResult:
    """
    Executes the full automated surveillance, drift, and attribution pipeline.

    Parameters:
    - sar_source: Path to Sentinel-1 SAR .tif, 2D/3D numpy array, or raw bytes.
    - bbox: (south, north, west, east) coordinates of the SAR scene.
    - detection_time: Timestamp of SAR image acquisition.
    - slick_id: Optional identifier string.
    - wind_nc: Path to ERA5 wind NetCDF file.
    - currents_nc: Path to CMEMS ocean currents NetCDF file.
    - ais_mode: 'synthetic' (default, offline deterministic) or 'gfw' (live API).
    - gfw_token: Optional GFW access token if ais_mode='gfw'.

    Returns:
    - ScenarioResult containing complete detection, drift, and ranked suspects.
    """
    t_start = time.time()
    
    # Defaults
    if bbox is None:
        bbox = DEFAULT_ROI.bbox
    if detection_time is None:
        detection_time = datetime(2024, 1, 3, 10, 0, 0)
    if slick_id is None:
        slick_id = f"spill_{detection_time.strftime('%Y%m%d_%H%M')}"
    if wind_nc is None:
        wind_nc = DEFAULT_WIND_NC
    if currents_nc is None:
        currents_nc = DEFAULT_CURRENTS_NC

    # 1. Load SAR raster
    if isinstance(sar_source, bytes):
        if not HAS_RASTERIO:
            raise ImportError("rasterio is required to load SAR GeoTIFF images from bytes.")
        with rasterio.open(io.BytesIO(sar_source)) as src:
            sar_raster = src.read().astype(np.float32)
    elif isinstance(sar_source, str):
        if not os.path.exists(sar_source):
            raise FileNotFoundError(f"SAR image file not found: {sar_source}")
        if not HAS_RASTERIO:
            raise ImportError("rasterio is required to load SAR GeoTIFF images.")
        with rasterio.open(sar_source) as src:
            sar_raster = src.read().astype(np.float32)
    else:
        sar_raster = sar_source.astype(np.float32)

    # 2. Detect Oil Slick
    detector = SARSpillDetector(weights_path=MODEL_WEIGHTS_PATH)
    mask, method_used, confidence = detector.detect_mask(sar_raster)
    slick = detector.extract_slick_geometry(
        mask=mask,
        bbox=bbox,
        timestamp=detection_time,
        slick_id=slick_id,
        confidence=confidence,
    )
    # Reclaim raster memory immediately for 512MB cloud servers
    del sar_raster, mask
    gc.collect()

    # 3. Load Metocean Environmental Field
    if not os.path.exists(wind_nc) or not os.path.exists(currents_nc):
        raise FileNotFoundError(
            f"Metocean NetCDF files missing:\nWind: {wind_nc}\nCurrents: {currents_nc}"
        )
    field = load_vector_field(wind_nc, currents_nc)
    # 3. Load Metocean Environmental Field (Real NetCDF or Adaptive Fallback)
    metocean_source = "real_netcdf"
    if wind_nc and currents_nc and os.path.exists(wind_nc) and os.path.exists(currents_nc):
        try:
            field = load_vector_field(wind_nc, currents_nc)
        except Exception as e:
            print(f"[Pipeline] Notice: NetCDF load failed ({e}). Switching to Adaptive Physics Engine.")
            field = AdaptiveVectorField(slick.centroid_lat, slick.centroid_lon)
            metocean_source = "adaptive_physics_engine"
    else:
        print(f"[Pipeline] NetCDF not provided/found. Initializing Adaptive Regional Physics Engine.")
        field = AdaptiveVectorField(slick.centroid_lat, slick.centroid_lon)
        metocean_source = "adaptive_physics_engine"

    # 4. Run Drift Hindcast (Spill Origin Estimation)
    origin = run_hindcast(slick, field)

    # 5. Run Drift Forecast (Shoreline / Trajectory Projection)
    forecast = run_forecast(slick, field)

    # 6. AIS Vessel Triage & Anomaly Scoring
    tracks: List[AISTrack] = []
    if ais_mode == "synthetic":
        tracks = generate_synthetic_coastal_ais(origin)
        candidate_scores = score_candidate_tracks(tracks, origin)
    elif ais_mode == "gfw":
        if not gfw_token:
            gfw_token = os.environ.get("GFW_API_ACCESS_TOKEN")
        if not gfw_token:
            raise ValueError("GFW_API_ACCESS_TOKEN required for ais_mode='gfw'")
        import asyncio
        from ais_spill_scoring import score_vessels_for_origin
        candidate_scores = asyncio.run(score_vessels_for_origin(origin, gfw_token))
    else:
        raise ValueError(f"Unknown ais_mode: {ais_mode}")

    # 7. Compile Scenario Result
    t_elapsed = round(time.time() - t_start, 3)
    scenario_id = f"SCN_{slick.slick_id}_{int(time.time())}"

    result = ScenarioResult(
        scenario_id=scenario_id,
        timestamp=detection_time,
        slick=slick,
        origin=origin,
        forecast=forecast,
        candidates=candidate_scores,
        candidate_tracks=tracks,
        execution_time_seconds=t_elapsed,
        metadata={
            "sar_method_used": method_used,
            "sar_confidence": round(confidence, 3),
            "wind_source": os.path.basename(wind_nc),
            "currents_source": os.path.basename(currents_nc),
            "metocean_source": metocean_source,
            "wind_source": os.path.basename(wind_nc) if wind_nc else "adaptive",
            "currents_source": os.path.basename(currents_nc) if currents_nc else "adaptive",
            "ais_mode": ais_mode,
            "num_candidates": len(candidate_scores),
        },
    )

    return result


