"""
FastAPI REST API Service Layer for SIH26143.
Serves oil spill detection, Lagrangian drift forecasting, and AIS attribution
for the Web GIS Tactical Dashboard.
"""
import os
import glob
import json
import shutil
import tempfile
from datetime import datetime
from typing import Optional, List, Dict, Any

import torch
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from schemas import ScenarioResult, SystemHealth
from app.config import (
    DEFAULT_SAR_TEST_IMAGE,
    DEFAULT_WIND_NC,
    DEFAULT_CURRENTS_NC,
    REGIONS,
    DEFAULT_ROI,
    MODEL_WEIGHTS_PATH,
)
from app.pipeline import run_pipeline

app = FastAPI(
    title="SIH26143: Satellite Oil Spill Detection & AIS Attribution API",
    description="Backend service providing Sentinel-1 SAR oil spill segmentation, Lagrangian drift trajectory forecasting, and AIS vessel attribution.",
    version="1.0.0",
)

# Enable CORS for frontend clients (e.g. Vite React running on port 5173 / 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health", response_model=SystemHealth)
def health_check() -> SystemHealth:
    """Returns server status, hardware acceleration, and model weights integrity."""
    cuda_available = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if cuda_available else "CPU"
    weights_exist = os.path.exists(MODEL_WEIGHTS_PATH)

    return SystemHealth(
        status="healthy",
        service="sih26143-pipeline-api",
        cuda_accelerated=cuda_available,
        device=device_name,
        model_weights_loaded=weights_exist,
        timestamp=datetime.utcnow(),
    )


@app.get("/api/v1/scenarios/presets")
def get_presets() -> Dict[str, Any]:
    """
    Returns available Indian coastal test regions and pre-cached SAR test images
    for quick 1-click loading during presentations.
    """
    # Scan for available test TIFFs in training/test directories
    sar_dir = os.path.dirname(DEFAULT_SAR_TEST_IMAGE)
    sample_images = []
    if os.path.exists(sar_dir):
        tifs = glob.glob(os.path.join(sar_dir, "*.tif"))
        for t in tifs[:10]:
            sample_images.append({
                "filename": os.path.basename(t),
                "full_path": t,
            })

    regions_data = {}
    for key, roi in REGIONS.items():
        regions_data[key] = {
            "name": roi.name,
            "bbox": {
                "south": roi.lat_min,
                "north": roi.lat_max,
                "west": roi.lon_min,
                "east": roi.lon_max,
            },
        }

    return {
        "default_region": "mumbai_coast",
        "regions": regions_data,
        "sample_images": sample_images,
    }


# In-memory cache for instant < 0.05s response on cloud instances
_DEFAULT_SCENARIO_CACHE = None


@app.post("/api/v1/scenarios/run-default", response_model=ScenarioResult)
def run_default_scenario() -> ScenarioResult:
    """
    Executes the flagship Mumbai High offshore scenario.
    Caches result in-memory so subsequent clicks are instantaneous (< 0.05s).
    Loads pre-computed verified scenario for instant (< 0.01s) zero-RAM execution
    on free cloud tiers, with live simulation fallback.
    """
    global _DEFAULT_SCENARIO_CACHE
    if _DEFAULT_SCENARIO_CACHE is not None:
        return _DEFAULT_SCENARIO_CACHE
    default_json = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "default_scenario.json")
    if os.path.exists(default_json):
        try:
            with open(default_json, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ScenarioResult(**data)
        except Exception as e:
            print(f"[FastAPI] Notice: could not load cached scenario ({e}), falling back to live computation.")

    try:
        result = run_pipeline(
            sar_source=DEFAULT_SAR_TEST_IMAGE,
            bbox=DEFAULT_ROI.bbox,
            detection_time=datetime(2024, 1, 3, 10, 0, 0),
            slick_id="mumbai_flagship_spill",
            wind_nc=DEFAULT_WIND_NC,
            currents_nc=DEFAULT_CURRENTS_NC,
            ais_mode="synthetic",
        )
        _DEFAULT_SCENARIO_CACHE = result
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")


@app.post("/api/v1/scenarios/run-preset/{region_key}", response_model=ScenarioResult)
def run_preset_scenario(region_key: str) -> ScenarioResult:
    """
    Executes or loads pre-computed verified scenario for selected maritime regions:
    'mumbai_coast', 'gujarat_kutch', 'ennore_port', or 'global_corridor'.
    """
    preset_files = {
        "mumbai_coast": "default_scenario.json",
        "gujarat_kutch": "benchmark_gujarat.json",
        "ennore_port": "benchmark_ennore.json",
        "global_corridor": "benchmark_global.json",
    }
    target_filename = preset_files.get(region_key, "default_scenario.json")
    cached_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", target_filename)
    if os.path.exists(cached_path):
        try:
            with open(cached_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ScenarioResult(**data)
        except Exception as e:
            print(f"[FastAPI] Notice: could not load preset file {target_filename} ({e}), running live...")

    if region_key not in REGIONS:
        region_key = "mumbai_coast"
    roi = REGIONS[region_key]

    try:
        result = run_pipeline(
            sar_source=DEFAULT_SAR_TEST_IMAGE,
            bbox=roi.bbox,
            detection_time=datetime(2024, 1, 3, 10, 0, 0),
            slick_id=f"{region_key}_spill",
            wind_nc=DEFAULT_WIND_NC,
            currents_nc=DEFAULT_CURRENTS_NC,
            ais_mode="synthetic",
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preset execution failed: {str(e)}")


@app.post("/api/v1/scenarios/analyze-image", response_model=ScenarioResult)
async def analyze_uploaded_image(
    file: UploadFile = File(..., description="Uploaded Sentinel-1 SAR raster (.tif, .png, .jpg)"),
    south: Optional[float] = Form(None),
    north: Optional[float] = Form(None),
    west: Optional[float] = Form(None),
    east: Optional[float] = Form(None),
    detection_time: Optional[str] = Form(None),
    region_preset: Optional[str] = Form("mumbai_coast"),
    sector_name: Optional[str] = Form(None),
) -> ScenarioResult:
    """
    Accepts ANY uploaded SAR image from judges/users.
    Streams directly to disk in 64KB chunks to prevent RAM blowup on 512MB free tier.
    Automatically segments the oil slick, executes adaptive ocean drift physics,
    and returns ranked AIS suspect attribution with new custom maritime sector registration.
    """
    tmp_path = None
    try:
        # 1. Resolve bounding box
        if south is not None and north is not None and west is not None and east is not None:
            bbox = (south, north, west, east)
        elif region_preset in REGIONS:
            bbox = REGIONS[region_preset].bbox
        else:
            bbox = DEFAULT_ROI.bbox

        # 2. Resolve detection timestamp
        if detection_time:
            dt = datetime.fromisoformat(detection_time)
        else:
            dt = datetime.utcnow()

        # 3. Stream uploaded file directly to disk in 64KB chunks (RAM footprint < 100KB)
        file_ext = os.path.splitext(file.filename)[1] or ".tif"
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            tmp_path = tmp_file.name
            shutil.copyfileobj(file.file, tmp_file, length=64 * 1024)

        if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        clean_basename = os.path.splitext(file.filename)[0].replace("_decimated", "")
        slick_id = f"custom_{clean_basename}_{int(datetime.utcnow().timestamp())}"

        # 4. Run pipeline directly using disk path with decimation-on-read
        result = run_pipeline(
            sar_source=tmp_path,
            bbox=bbox,
            detection_time=dt,
            slick_id=slick_id,
            wind_nc=DEFAULT_WIND_NC,
            currents_nc=DEFAULT_CURRENTS_NC,
            ais_mode="synthetic",
        )

        # Attach custom sector metadata for frontend registration
        resolved_sector_name = sector_name or f"Sector: {clean_basename.replace('_', ' ').title()}"
        result.metadata["custom_sector"] = {
            "key": f"custom_{int(datetime.utcnow().timestamp())}",
            "name": resolved_sector_name,
            "bbox": {
                "south": float(bbox[0]),
                "north": float(bbox[1]),
                "west": float(bbox[2]),
                "east": float(bbox[3]),
            },
        }

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze uploaded image: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


# -------------------------------------------------------------
# Mount Frontend Web Dashboard (React Dist)
# -------------------------------------------------------------
from fastapi.staticfiles import StaticFiles

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
    print(f"[FastAPI] React Tactical Dashboard mounted from {frontend_dist}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)

