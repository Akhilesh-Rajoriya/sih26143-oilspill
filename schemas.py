"""
Core Data Contracts and Pydantic Schemas for SIH26143.
Defines end-to-end data transfer objects for:
1. Sentinel-1 SAR dark spot oil spill detection.
2. Lagrangian hydrodynamic drift modeling (hindcast origin & forecast path).
3. AIS vessel tracking, correlation, and multi-factor Bayesian attribution.
4. Orchestration results, system health telemetry, and regional maritime sectors.
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


# =====================================================================
# 0. Core Enums & Geographic Primitives
# =====================================================================

class AgeClass(str, Enum):
    """Weathering stage of the detected oil spill."""
    fresh = "fresh"
    moderate = "moderate"
    weathered = "weathered"


class GeoBoundingBox(BaseModel):
    """Geographic bounding box coordinates in WGS 84 (EPSG:4326)."""
    south: float = Field(..., ge=-90.0, le=90.0, description="Southern latitude boundary")
    north: float = Field(..., ge=-90.0, le=90.0, description="Northern latitude boundary")
    west: float = Field(..., ge=-180.0, le=180.0, description="Western longitude boundary")
    east: float = Field(..., ge=-180.0, le=180.0, description="Eastern longitude boundary")

    @property
    def as_tuple(self) -> Tuple[float, float, float, float]:
        """Returns bbox as tuple: (south, north, west, east)."""
        return (self.south, self.north, self.west, self.east)


class RegionPreset(BaseModel):
    """Operational maritime surveillance sector definition."""
    name: str = Field(..., description="Human-readable sector name (e.g. Mumbai High, Strait of Hormuz)")
    bbox: GeoBoundingBox = Field(..., description="Geographic boundary coordinates")


class SampleImage(BaseModel):
    """Metadata for preloaded Sentinel-1 SAR test rasters."""
    filename: str = Field(..., description="File name of the sample raster")
    full_path: str = Field(..., description="Absolute path on system")


class ScenarioPresetsResponse(BaseModel):
    """Response payload for GET /api/v1/scenarios/presets."""
    default_region: str = Field(default="mumbai_coast", description="Default active region key")
    regions: Dict[str, RegionPreset] = Field(..., description="Dictionary of operational maritime sectors")
    sample_images: List[SampleImage] = Field(default_factory=list, description="Available sample SAR rasters")


class SystemHealth(BaseModel):
    """System health check and hardware acceleration telemetry."""
    status: str = Field(default="healthy", description="Service operational status flag")
    service: str = Field(default="sih26143-pipeline-api", description="Service identifier")
    cuda_accelerated: bool = Field(..., description="Whether CUDA GPU acceleration is active")
    device: str = Field(..., description="Active compute device name (e.g. NVIDIA RTX 3050, CPU)")
    model_weights_loaded: bool = Field(..., description="Whether trained U-Net checkpoint exists on disk")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Health check timestamp")


# =====================================================================
# 1. SAR Detection Module
# =====================================================================

class SARScene(BaseModel):
    """Metadata describing an ingested Sentinel-1 SAR satellite scene."""
    scene_id: str
    timestamp: datetime
    bbox_north: float
    bbox_south: float
    bbox_west: float
    bbox_east: float
    raster_path: str


class SlickDetection(BaseModel):
    """Automated oil spill segmentation polygon and morphometric characteristics."""
    slick_id: str
    centroid_lat: float = Field(ge=-90, le=90, description="Slick centroid latitude in WGS 84")
    centroid_lon: float = Field(ge=-180, le=180, description="Slick centroid longitude in WGS 84")
    timestamp: datetime = Field(description="Satellite acquisition timestamp")
    polygon: List[List[float]] = Field(description="List of [lat, lon] vertices defining slick boundary")
    area_km2: float = Field(ge=0, description="Estimated slick surface area in square kilometers")
    perimeter_km: float = Field(ge=0, description="Slick perimeter in kilometers")
    elongation_ratio: float = Field(default=1.0, description="Ratio of major to minor axis (higher indicates trailing discharge)")
    oil_likelihood_confidence: float = Field(ge=0, le=1, description="Confidence score from U-Net / contextual filter")
    age_class: AgeClass = Field(default=AgeClass.moderate, description="Weathering age class")


# =====================================================================
# 2. Drift Model Module (Lagrangian Hindcast & Forecast)
# =====================================================================

class EnvironmentalField(BaseModel):
    """References to metocean NetCDF data products (ERA5 & CMEMS)."""
    slick_id: str
    wind_data_path: str        # path to fetched ERA5 NetCDF file
    current_data_path: str     # path to fetched CMEMS NetCDF file
    hours_before: int
    hours_after: int


class OriginWindow(BaseModel):
    """Estimated spill discharge origin window derived from backward drift modeling."""
    slick_id: str
    center_lat: float = Field(ge=-90, le=90, description="Estimated origin center latitude")
    center_lon: float = Field(ge=-180, le=180, description="Estimated origin center longitude")
    radius_km: float = Field(ge=0, description="Uncertainty search radius in kilometers")
    time_start: datetime = Field(description="Start of suspect discharge time window")
    time_end: datetime = Field(description="End of suspect discharge time window")
    confidence: float = Field(ge=0, le=1, description="Confidence in hindcast origin window")


class ForecastPoint(BaseModel):
    """Single trajectory coordinate along projected forward drift path."""
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    timestamp: datetime
    uncertainty_km: Optional[float] = Field(default=None, ge=0)


class ForecastPath(BaseModel):
    """Forward trajectory projection modeling future slick movement & coastal risk."""
    slick_id: str
    points: List[ForecastPoint] = Field(default_factory=list)


# =====================================================================
# 3. AIS Telemetry & Suspect Attribution Module
# =====================================================================

class AISPosition(BaseModel):
    """Single AIS position telemetry report."""
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    timestamp: datetime
    speed_over_ground: float = Field(ge=0, description="Speed in knots (SOG)")
    course_over_ground: float = Field(ge=0, le=360, description="Course in degrees (COG)")


class AISTrack(BaseModel):
    """Complete historical AIS voyage trajectory for a single candidate vessel."""
    mmsi: str = Field(description="Maritime Mobile Service Identity")
    vessel_name: Optional[str] = Field(default=None, description="Vessel name")
    vessel_type: str = Field(default="Unknown", description="Vessel category (Tanker, Cargo, etc.)")
    positions: List[AISPosition] = Field(default_factory=list)


class VesselScore(BaseModel):
    """Multi-factor Bayesian suspect attribution score matching a vessel to the origin window."""
    mmsi: str
    vessel_name: Optional[str] = None
    vessel_type: str
    proximity_score: float = Field(ge=0, le=1, description="Spatio-temporal proximity to origin cone (0-1)")
    trajectory_score: float = Field(ge=0, le=1, description="Alignment with slick elongation axis (0-1)")
    anomaly_score: float = Field(ge=0, le=1, description="Behavioral anomaly rating: AIS blackout, speed reduction (0-1)")
    total_score: float = Field(ge=0, le=1, description="Weighted composite attribution probability (0-1)")
    rank: int = Field(default=1, description="Rank among suspect vessels")
    anomaly_flags: List[str] = Field(default_factory=list, description="Forensic behavioral anomaly notices")


# =====================================================================
# 4. Orchestration & Master Scenario Result
# =====================================================================

class ScenarioResult(BaseModel):
    """Master pipeline result combining detection, drift, and ranked suspect attribution."""
    scenario_id: str
    timestamp: datetime
    slick: SlickDetection
    origin: OriginWindow
    forecast: ForecastPath
    candidates: List[VesselScore]
    candidate_tracks: List[AISTrack] = Field(default_factory=list)
    execution_time_seconds: float
    metadata: Dict[str, Any] = Field(default_factory=dict)