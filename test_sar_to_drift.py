import sys
import os
from datetime import datetime
import numpy as np

# Ensure workspace root is on python path
sys.path.insert(0, r"d:\sih26143")

from app.sar.detector import SARSpillDetector
from drift_model import load_vector_field, run_hindcast, run_forecast, haversine_km

print("="*60)
print("TESTING SAR DETECTION -> DRIFT MODEL INTEGRATION")
print("="*60)

# 1. Initialize SAR Detector
detector = SARSpillDetector(weights_path=r"d:\sih26143\models\unet_baseline_local.pth")

# 2. Simulate a 512x512 SAR backscatter patch with an oil slick signature
# (Gaussian ocean speckle + dark capillary wave dampening strip)

import rasterio
REAL_IMAGE_PATH = "D:/SIH_OilSpill/training_data/raw/images/Oil/00004.tif"  # use any real filename from your Oil folder
with rasterio.open(REAL_IMAGE_PATH) as src:
    synthetic_sar = src.read().astype(np.float32)

# 3. Detect Slick
mumbai_bbox = (18.6, 19.2, 72.5, 73.1) # south, north, west, east
detect_time = datetime(2024, 1, 3, 10, 0, 0)

mask, method_used, confidence = detector.detect_mask(synthetic_sar)
print(f"\n[Detection method used]: {method_used} (confidence: {confidence:.3f})")
slick = detector.extract_slick_geometry(mask, mumbai_bbox, detect_time, slick_id="mumbai_spill_01", confidence=confidence)

print(f"\n[SAR Detection Output]:")
print(f"  Slick ID:         {slick.slick_id}")
print(f"  Centroid Lat/Lon: ({slick.centroid_lat}, {slick.centroid_lon})")
print(f"  Area:             {slick.area_km2} km2")
print(f"  Perimeter:        {slick.perimeter_km} km")
print(f"  Elongation:       {slick.elongation_ratio}")
print(f"  Confidence:       {slick.oil_likelihood_confidence * 100:.1f}%")
print(f"  Age Class:        {slick.age_class.value}")
print(f"  Polygon Vertices: {len(slick.polygon)} points")

# 4. Connect to Drift Model
wind_nc = r"D:\SIH_OilSpill\data\slick1_wind.nc"
current_nc = r"D:\SIH_OilSpill\data\slick1_currents_hourly.nc"

if os.path.exists(wind_nc) and os.path.exists(current_nc):
    print(f"\n[Feeding Slick into Drift Engine]...")
    field = load_vector_field(wind_nc, current_nc)
    
    # Run Hindcast
    origin = run_hindcast(slick, field)
    print(f"\n[Hindcast Origin Result]:")
    print(f"  Origin Center: ({origin.center_lat:.4f}, {origin.center_lon:.4f})")
    print(f"  Radius:        {origin.radius_km:.2f} km")
    print(f"  Time Window:   {origin.time_start} -> {origin.time_end}")
    print(f"  Confidence:    {origin.confidence * 100:.1f}%")

    # Run Forecast
    forecast = run_forecast(slick, field)
    print(f"\n[Forecast Shoreline Result]:")
    print(f"  Forecast Points: {len(forecast.points)}")
    print(f"  Final Position:  ({forecast.points[-1].lat:.4f}, {forecast.points[-1].lon:.4f})")
    print(f"  Max Uncertainty: {forecast.points[-1].uncertainty_km:.2f} km")
    
    print("\n" + "="*60)
    print("SUCCESS: SAR DETECTION -> DRIFT MODEL FULLY CONNECTED!")
    print("="*60)
else:
    print("NetCDF files not found on disk.")
