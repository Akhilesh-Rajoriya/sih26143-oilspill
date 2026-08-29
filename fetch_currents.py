import copernicusmarine
from datetime import datetime, timedelta

def compute_bbox(lat, lon, radius_deg=1.0):
    """Returns (west, east, south, north) box around a center point."""
    north = lat + radius_deg
    south = lat - radius_deg
    west = lon - radius_deg
    east = lon + radius_deg
    return west, east, south, north

def fetch_ocean_currents(lat, lon, timestamp: datetime, out_path: str,
                          radius_deg=1.0, hours_before=72, hours_after=48):
    """
    Fetches hourly ocean surface current (circulation + tide + wave-drift, summed)
    for a bounding box around (lat, lon),
    covering [timestamp - hours_before, timestamp + hours_after].
    Uses the global SMOC product - recommended by CMEMS for drift/Lagrangian applications.
    """
    west, east, south, north = compute_bbox(lat, lon, radius_deg)
    start_time = timestamp - timedelta(hours=hours_before)
    end_time = timestamp + timedelta(hours=hours_after)

    copernicusmarine.subset(
        dataset_id="cmems_mod_glo_phy_anfc_merged-uv_PT1H-i",
        variables=["utotal", "vtotal"],
        minimum_longitude=west,
        maximum_longitude=east,
        minimum_latitude=south,
        maximum_latitude=north,
        start_datetime=start_time.strftime("%Y-%m-%dT%H:%M:%S"),
        end_datetime=end_time.strftime("%Y-%m-%dT%H:%M:%S"),
        minimum_depth=0,
        maximum_depth=1,
        output_filename=out_path,
    )
    print(f"Saved hourly current data to {out_path}")
    return out_path


if __name__ == "__main__":
    test_lat, test_lon = 18.9, 72.8
    test_time = datetime(2024, 1, 3, 10, 0)

    fetch_ocean_currents(
        lat=test_lat,
        lon=test_lon,
        timestamp=test_time,
        out_path="D:/SIH_OilSpill/data/slick1_currents_hourly.nc"
    )