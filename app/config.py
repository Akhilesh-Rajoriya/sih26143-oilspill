import os
from dataclasses import dataclass
from typing import Tuple

@dataclass
class RegionOfInterest:
    name: str
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float

    @property
    def bbox(self) -> Tuple[float, float, float, float]:
        """Returns bbox as (south, north, west, east)."""
        return (self.lat_min, self.lat_max, self.lon_min, self.lon_max)


# Predefined coastal test regions in Indian waters
REGIONS = {
    "mumbai_coast": RegionOfInterest(
        name="Mumbai Coast / Offshore High",
        lat_min=18.6,
        lat_max=19.4,
        lon_min=72.4,
        lon_max=73.2,
    ),
    "gujarat_kutch": RegionOfInterest(
        name="Gulf of Kutch Shipping Channel",
        lat_min=22.2,
        lat_max=22.9,
        lon_min=68.8,
        lon_max=69.8,
    ),
    "ennore_port": RegionOfInterest(
        name="Ennore / Chennai Port Corridor",
        lat_min=13.1,
        lat_max=13.6,
        lon_min=80.2,
        lon_max=80.6,
    ),
    "global_corridor": RegionOfInterest(
        name="Global Maritime Corridor (Strait of Hormuz / Gulf of Oman)",
        lat_min=24.8,
        lat_max=25.8,
        lon_min=56.5,
        lon_max=57.8,
    ),
}

DEFAULT_ROI = REGIONS["mumbai_coast"]

# Model paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_WEIGHTS_PATH = os.path.join(BASE_DIR, "models", "unet_baseline_local.pth")

# Metocean data defaults
LOCAL_DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_DIR = LOCAL_DATA_DIR if os.path.exists(LOCAL_DATA_DIR) else r"D:\SIH_OilSpill\data"
DEFAULT_WIND_NC = os.path.join(DATA_DIR, "slick1_wind.nc")
DEFAULT_CURRENTS_NC = os.path.join(DATA_DIR, "slick1_currents_hourly.nc")

# Sample SAR test raster
local_sar = os.path.join(LOCAL_DATA_DIR, "00004.tif")
DEFAULT_SAR_TEST_IMAGE = local_sar if os.path.exists(local_sar) else r"D:\SIH_OilSpill\training_data\raw\images\Oil\00004.tif"

# AIS Scoring Weights (matching brain.md)
AIS_WEIGHTS = {
    "proximity": 0.35,
    "temporal": 0.25,
    "track": 0.20,
    "anomaly": 0.10,
    "gap_risk": 0.10,
}

