import copernicusmarine
from datetime import timedelta
from schemas import SlickDetection

def compute_bbox(lat, lon, radius_deg=1.0):
    north = lat + radius_deg
    south = lat - radius_deg
    west = lon - radius_deg
    east = lon + radius_deg
    return west, east, south, north

def fetch_ocean_currents(slick: SlickDetection, out_path: str,
                          radius_deg=1.0, hours_before=72, hours_after=48):
    """
    Fetches hourly ocean surface current (utotal, vtotal) around a detected slick's centroid,
    covering [slick.timestamp - hours_before, slick.timestamp + hours_after].
    """
    west, east, south, north = compute_bbox(slick.centroid_lat, slick.centroid_lon, radius_deg)
    start_time = slick.timestamp - timedelta(hours=hours_before)
    end_time = slick.timestamp + timedelta(hours=hours_after)

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

    fetch_ocean_currents(
        slick=test_slick,
        out_path="D:/SIH_OilSpill/data/slick1_currents_hourly.nc"
    )