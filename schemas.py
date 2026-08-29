from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from enum import Enum


# ---------- Enums ----------

class AgeClass(str, Enum):
    fresh = "fresh"
    moderate = "moderate"
    weathered = "weathered"


# ---------- 1. SAR Detection Module ----------

class SARScene(BaseModel):
    scene_id: str
    timestamp: datetime
    bbox_north: float
    bbox_south: float
    bbox_west: float
    bbox_east: float
    raster_path: str


class SlickDetection(BaseModel):
    slick_id: str
    centroid_lat: float = Field(ge=-90, le=90)
    centroid_lon: float = Field(ge=-180, le=180)
    timestamp: datetime
    polygon: List[List[float]]          # list of [lat, lon] vertices
    area_km2: float
    perimeter_km: float
    elongation_ratio: float
    oil_likelihood_confidence: float = Field(ge=0, le=1)
    age_class: AgeClass


# ---------- 2. Drift Model Module ----------

class EnvironmentalField(BaseModel):
    slick_id: str
    wind_data_path: str        # path to fetched ERA5 NetCDF file
    current_data_path: str     # path to fetched CMEMS NetCDF file
    hours_before: int
    hours_after: int


class OriginWindow(BaseModel):
    slick_id: str
    center_lat: float
    center_lon: float
    radius_km: float
    time_start: datetime
    time_end: datetime
    confidence: float = Field(ge=0, le=1)


class ForecastPoint(BaseModel):
    lat: float
    lon: float
    timestamp: datetime


class ForecastPath(BaseModel):
    slick_id: str
    points: List[ForecastPoint]


# ---------- 3. AIS Scoring Module ----------

class AISPosition(BaseModel):
    lat: float
    lon: float
    timestamp: datetime
    speed_over_ground: float
    course_over_ground: float


class AISTrack(BaseModel):
    mmsi: str
    vessel_name: Optional[str] = None
    vessel_type: str
    positions: List[AISPosition]


class VesselScore(BaseModel):
    mmsi: str
    vessel_name: Optional[str] = None
    vessel_type: str
    proximity_score: float = Field(ge=0, le=1)
    trajectory_score: float = Field(ge=0, le=1)
    anomaly_score: float = Field(ge=0, le=1)
    total_score: float = Field(ge=0, le=1)
    rank: int
    anomaly_flags: List[str] = []