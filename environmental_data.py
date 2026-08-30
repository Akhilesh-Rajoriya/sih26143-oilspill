import cdsapi
import xarray as xr
from datetime import timedelta
from schemas import SlickDetection

def compute_bbox(lat, lon, radius_deg=1.0):
    north = lat + radius_deg
    south = lat - radius_deg
    west = lon - radius_deg
    east = lon + radius_deg
    return [north, west, south, east]

def compute_time_window(timestamp, hours_before=72, hours_after=48):
    start = timestamp - timedelta(hours=hours_before)
    end = timestamp + timedelta(hours=hours_after)
    hours = []
    current = start
    while current <= end:
        hours.append(current)
        current += timedelta(hours=1)
    return hours

def fetch_era5_wind(slick: SlickDetection, out_path: str, radius_deg=2.5, hours_before=72, hours_after=48):
    """
    Fetches ERA5 10m wind (u,v) for a bounding box around a detected slick's centroid,
    covering [slick.timestamp - hours_before, slick.timestamp + hours_after].
    Requests each (year, month) separately to avoid CDS cross-producting
    year/month/day into unrelated dates.
    """
    bbox = compute_bbox(slick.centroid_lat, slick.centroid_lon, radius_deg)
    time_points = compute_time_window(slick.timestamp, hours_before, hours_after)

    # Group time points by (year, month) so each API call only spans real dates
    groups = {}
    for t in time_points:
        key = (t.strftime("%Y"), t.strftime("%m"))
        groups.setdefault(key, {"days": set(), "hours": set()})
        groups[key]["days"].add(t.strftime("%d"))
        groups[key]["hours"].add(t.strftime("%H:00"))

    client = cdsapi.Client()
    temp_files = []

    for i, ((year, month), vals) in enumerate(groups.items()):
        temp_path = out_path.replace(".nc", f"_part{i}.nc")
        client.retrieve(
            "reanalysis-era5-single-levels",
            {
                "product_type": "reanalysis",
                "variable": ["10m_u_component_of_wind", "10m_v_component_of_wind"],
                "year": year,
                "month": month,
                "day": sorted(vals["days"]),
                "time": sorted(vals["hours"]),
                "area": bbox,
                "format": "netcdf",
            },
            temp_path
        )
        temp_files.append(temp_path)

    # Merge all monthly parts into one file, keep only the exact window we need
    datasets = [xr.open_dataset(f) for f in temp_files]
    merged = xr.concat(datasets, dim="valid_time").sortby("valid_time")

    start_time = time_points[0]
    end_time = time_points[-1]
    merged = merged.sel(valid_time=slice(start_time, end_time))

    merged.to_netcdf(out_path)
    print(f"Saved wind data to {out_path} ({merged.sizes['valid_time']} time steps)")
    return out_path


if __name__ == "__main__":
    test_slick = SlickDetection(
        slick_id="test_slick_1",
        centroid_lat=18.9,
        centroid_lon=72.8,
        timestamp="2024-01-03T10:00:00",
        polygon=[[18.9, 72.8], [18.95, 72.85], [18.85, 72.85]],
        area_km2=2.5,
        perimeter_km=6.1,
        elongation_ratio=3.2,
        oil_likelihood_confidence=0.87,
        age_class="fresh"
    )

    fetch_era5_wind(
        slick=test_slick,
        out_path="D:/SIH_OilSpill/data/slick1_wind.nc"
    )