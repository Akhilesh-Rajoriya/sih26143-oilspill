"""
End-to-End Master Pipeline Verification Test.
Tests the full pipeline from raw SAR GeoTIFF image to ranked vessel attribution.
"""
import sys
import os
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, r"d:\sih26143")

from app.pipeline import run_pipeline
from app.config import DEFAULT_SAR_TEST_IMAGE, DEFAULT_WIND_NC, DEFAULT_CURRENTS_NC, REGIONS

def main():
    print("=" * 70)
    print("RUNNING END-TO-END MASTER PIPELINE VERIFICATION")
    print("=" * 70)

    # 1. Configuration
    sar_image = DEFAULT_SAR_TEST_IMAGE
    mumbai_bbox = REGIONS["mumbai_coast"].bbox # (18.6, 19.4, 72.4, 73.2)
    detection_time = datetime(2024, 1, 3, 10, 0, 0)
    slick_id = "mumbai_spill_eval_01"

    print(f"\n[Test Inputs]:")
    print(f"  SAR Image:      {sar_image}")
    print(f"  Region Bounding Box: {mumbai_bbox}")
    print(f"  Detection Time: {detection_time.isoformat()}")
    print(f"  Wind NetCDF:    {DEFAULT_WIND_NC}")
    print(f"  Current NetCDF: {DEFAULT_CURRENTS_NC}")

    if not os.path.exists(sar_image):
        print(f"ERROR: Sample SAR image not found at {sar_image}")
        sys.exit(1)

    # 2. Run Pipeline
    print("\nExecuting run_pipeline()...")
    result = run_pipeline(
        sar_source=sar_image,
        bbox=mumbai_bbox,
        detection_time=detection_time,
        slick_id=slick_id,
        wind_nc=DEFAULT_WIND_NC,
        currents_nc=DEFAULT_CURRENTS_NC,
        ais_mode="synthetic",
    )

    # 3. Print Results & Assertions
    print("\n" + "=" * 70)
    print("PIPELINE EXECUTION COMPLETED")
    print("=" * 70)
    print(f"Scenario ID:           {result.scenario_id}")
    print(f"Total Execution Time:  {result.execution_time_seconds:.3f} seconds")
    print(f"Metadata:              {result.metadata}")

    print("\n--- 1. SAR DETECTION ---")
    print(f"  Slick ID:            {result.slick.slick_id}")
    print(f"  Centroid Lat/Lon:    ({result.slick.centroid_lat:.4f}, {result.slick.centroid_lon:.4f})")
    print(f"  Estimated Area:      {result.slick.area_km2:.2f} km2")
    print(f"  Estimated Perimeter: {result.slick.perimeter_km:.2f} km")
    print(f"  Elongation Ratio:    {result.slick.elongation_ratio:.2f}")
    print(f"  Confidence:          {result.slick.oil_likelihood_confidence * 100:.1f}%")
    print(f"  Age Classification:  {result.slick.age_class.value}")
    print(f"  Polygon Vertices:    {len(result.slick.polygon)} points")

    print("\n--- 2. DRIFT HINDCAST (SPILL ORIGIN) ---")
    print(f"  Origin Center:       ({result.origin.center_lat:.4f}, {result.origin.center_lon:.4f})")
    print(f"  Search Radius:       {result.origin.radius_km:.2f} km")
    print(f"  Estimated Time:      {result.origin.time_start} -> {result.origin.time_end}")
    print(f"  Model Confidence:    {result.origin.confidence * 100:.1f}%")

    print("\n--- 3. DRIFT FORECAST (TRAJECTORY) ---")
    print(f"  Forecast Timesteps:  {len(result.forecast.points)} hourly points")
    print(f"  Terminal Coordinate: ({result.forecast.points[-1].lat:.4f}, {result.forecast.points[-1].lon:.4f})")
    print(f"  Max Uncertainty:     {result.forecast.points[-1].uncertainty_km:.2f} km")

    print("\n--- 4. AIS VESSEL ATTRIBUTION RANKINGS ---")
    print(f"{'Rank':<5} {'Vessel Name':<20} {'MMSI':<12} {'Type':<22} {'Score':<8} {'Prox':<6} {'Track':<6} {'Anom':<6} Flags")
    print("-" * 105)
    for c in result.candidates:
        flag_str = "; ".join(c.anomaly_flags) if c.anomaly_flags else "None"
        print(f"#{c.rank:<4} {c.vessel_name or 'Unknown':<20} {c.mmsi:<12} {c.vessel_type:<22} {c.total_score:<8.3f} {c.proximity_score:<6.2f} {c.trajectory_score:<6.2f} {c.anomaly_score:<6.2f} {flag_str}")

    # Assertions
    assert result.slick.area_km2 > 0, "Slick area must be greater than zero."
    assert result.origin.radius_km > 0, "Origin radius must be greater than zero."
    assert len(result.forecast.points) > 0, "Forecast must contain trajectory points."
    assert len(result.candidates) > 0, "Candidate vessels must be scored."
    assert result.candidates[0].mmsi == "419001234", "Suspect tanker must be ranked #1."
    assert result.candidates[0].total_score > 0.70, "Suspect score must be high (>0.70)."
    assert result.execution_time_seconds < 15.0, f"Cold-start pipeline execution too slow: {result.execution_time_seconds:.2f}s"

    print("\n" + "=" * 70)
    print("ALL ASSERTIONS PASSED! END-TO-END PIPELINE IS 100% OPERATIONAL.")
    print("=" * 70)


if __name__ == "__main__":
    main()

