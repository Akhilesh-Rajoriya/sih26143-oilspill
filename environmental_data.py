import cdsapi
from datetime import datetime, timedelta

def compute_bbox(lat, lon, radius_deg=1.0):
    """Returns [North, West, South, East] box around a center point."""
    north = lat + radius_deg
    south = lat - radius_deg
    west = lon - radius_deg
    east = lon + radius_deg
    return [north, west, south, east]

def compute_time_window(timestamp: datetime, hours_before=72, hours_after=48):
    """Returns list of datetimes covering the hindcast+forecast window."""
    start = timestamp - timedelta(hours=hours_before)
    end = timestamp + timedelta(hours=hours_after)
    hours = []
    current = start
    while current <= end:
        hours.append(current)
        current += timedelta(hours=1)
    return hours

def fetch_era5_wind(lat, lon, timestamp: datetime, out_path: str, radius_deg=1.0, hours_before=72, hours_after=48):
    """
    Fetches ERA5 10m wind (u,v) for a bounding box around (lat, lon),
    covering [timestamp - hours_before, timestamp + hours_after].
    """
    bbox = compute_bbox(lat, lon, radius_deg)
    time_points = compute_time_window(timestamp, hours_before, hours_after)

    years = sorted(set(t.strftime("%Y") for t in time_points))
    months = sorted(set(t.strftime("%m") for t in time_points))
    days = sorted(set(t.strftime("%d") for t in time_points))
    hours = sorted(set(t.strftime("%H:00") for t in time_points))

    client = cdsapi.Client()
    client.retrieve(
        "reanalysis-era5-single-levels",
        {
            "product_type": "reanalysis",
            "variable": ["10m_u_component_of_wind", "10m_v_component_of_wind"],
            "year": years,
            "month": months,
            "day": days,
            "time": hours,
            "area": bbox,
            "format": "netcdf",
        },
        out_path
    )
    print(f"Saved wind data to {out_path}")
    return out_path


if __name__ == "__main__":
    test_lat, test_lon = 18.9, 72.8
    test_time = datetime(2024, 1, 3, 10, 0)

    fetch_era5_wind(
        lat=test_lat,
        lon=test_lon,
        timestamp=test_time,
        out_path="D:/SIH_OilSpill/data/slick1_wind.nc"
    )