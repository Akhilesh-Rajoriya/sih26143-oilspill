from dataclasses import dataclass

@dataclass
class RegionOfInterest:
    lat_min: float = 18.5
    lat_max: float = 19.5
    lon_min: float = 70.5
    lon_max: float = 71.5