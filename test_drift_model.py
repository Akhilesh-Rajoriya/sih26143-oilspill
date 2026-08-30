"""
Basic sanity checks for drift_model.py.
Run this any time you change the drift model code, to catch regressions
automatically instead of eyeballing printed numbers.
"""
from schemas import SlickDetection
from drift_model import load_vector_field, run_hindcast, run_forecast, haversine_km


def run_all_tests():
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

    field = load_vector_field(
        "D:/SIH_OilSpill/data/slick1_wind.nc",
        "D:/SIH_OilSpill/data/slick1_currents_hourly.nc"
    )

    print("Running hindcast...")
    origin = run_hindcast(test_slick, field)

    print("Running forecast...")
    forecast = run_forecast(test_slick, field)

    failures = []

    # --- Hindcast checks ---
    if not (0.0 <= origin.confidence <= 1.0):
        failures.append(f"confidence out of range: {origin.confidence}")

    dist_from_detection = haversine_km(
        test_slick.centroid_lat, test_slick.centroid_lon,
        origin.center_lat, origin.center_lon
    )
    if dist_from_detection > 300:
        failures.append(f"origin implausibly far from detection point: {dist_from_detection:.1f}km")

    if origin.radius_km <= 0:
        failures.append(f"radius_km should be positive, got {origin.radius_km}")

    if origin.time_start >= origin.time_end:
        failures.append("time_start should be before time_end")

    # --- Forecast checks ---
    if len(forecast.points) < 2:
        failures.append("forecast should have at least 2 points")

    first = forecast.points[0]
    if abs(first.lat - test_slick.centroid_lat) > 0.001 or abs(first.lon - test_slick.centroid_lon) > 0.001:
        failures.append("forecast's first point should match the slick's detected position")

    if first.uncertainty_km != 0.0:
        failures.append(f"forecast's first point should have zero uncertainty, got {first.uncertainty_km}")

    for i in range(1, len(forecast.points)):
        if forecast.points[i].timestamp <= forecast.points[i - 1].timestamp:
            failures.append(f"forecast timestamps should be strictly increasing at index {i}")
            break

    # --- Report ---
    print("\n" + "=" * 50)
    if failures:
        print(f"FAILED: {len(failures)} issue(s) found")
        for f in failures:
            print(f"  - {f}")
    else:
        print("ALL CHECKS PASSED")
    print("=" * 50)

    return len(failures) == 0


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)