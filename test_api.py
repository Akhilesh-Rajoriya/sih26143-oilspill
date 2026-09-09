"""
Automated Test Suite for FastAPI Endpoints.
Verifies REST API endpoints:
- Health check
- Scenario presets
- Default scenario execution
- Custom image upload analysis
"""
import sys
import os

# Add root directory to sys.path
sys.path.insert(0, r"d:\sih26143")

from fastapi.testclient import TestClient
from app.main import app
from app.config import DEFAULT_SAR_TEST_IMAGE

client = TestClient(app)

def test_health():
    print("Testing /api/v1/health...")
    response = client.get("/api/v1/health")
    assert response.status_code == 200, f"Health check failed: {response.text}"
    data = response.json()
    print("  Health response:", data)
    assert data["status"] == "healthy"
    assert data["service"] == "sih26143-pipeline-api"
    print("  [PASSED] Health endpoint verified.")

def test_presets():
    print("\nTesting /api/v1/scenarios/presets...")
    response = client.get("/api/v1/scenarios/presets")
    assert response.status_code == 200, f"Presets check failed: {response.text}"
    data = response.json()
    print(f"  Available regions: {list(data['regions'].keys())}")
    print(f"  Available sample images: {len(data['sample_images'])}")
    assert "mumbai_coast" in data["regions"]
    print("  [PASSED] Presets endpoint verified.")

def test_run_default():
    print("\nTesting POST /api/v1/scenarios/run-default...")
    response = client.post("/api/v1/scenarios/run-default")
    assert response.status_code == 200, f"Default scenario failed: {response.text}"
    data = response.json()
    print(f"  Scenario ID: {data['scenario_id']}")
    print(f"  Execution Time: {data['execution_time_seconds']}s")
    print(f"  Slick Area: {data['slick']['area_km2']:.2f} km2")
    print(f"  Top Candidate: {data['candidates'][0]['vessel_name']} ({data['candidates'][0]['mmsi']}) - Score: {data['candidates'][0]['total_score']}")
    assert data["slick"]["area_km2"] > 0
    assert data["candidates"][0]["mmsi"] == "419001234"
    print("  [PASSED] Run default scenario endpoint verified.")

def test_run_presets():
    print("\nTesting POST /api/v1/scenarios/run-preset/global_corridor...")
    response = client.post("/api/v1/scenarios/run-preset/global_corridor")
    assert response.status_code == 200, f"Global corridor preset failed: {response.text}"
    data = response.json()
    print(f"  Global Scenario ID: {data['scenario_id']}")
    print(f"  Validation Tier: {data['metadata'].get('validation_tier')}")
    print(f"  Slick Area: {data['slick']['area_km2']} km2")
    print(f"  Top Suspect: {data['candidates'][0]['vessel_name']} ({data['candidates'][0]['vessel_type']}) - Score: {data['candidates'][0]['total_score']}")
    assert data["candidates"][0]["vessel_name"] == "MT Global Horizon"
    print("  [PASSED] Global corridor 100% real preset verified.")

def test_upload_image():
    print("\nTesting POST /api/v1/scenarios/analyze-image with image upload...")
    if not os.path.exists(DEFAULT_SAR_TEST_IMAGE):
        print("  Skipping upload test: sample image file not found.")
        return

    with open(DEFAULT_SAR_TEST_IMAGE, "rb") as f:
        response = client.post(
            "/api/v1/scenarios/analyze-image",
            files={"file": ("test_sar.tif", f, "image/tiff")},
            data={"region_preset": "mumbai_coast"},
        )
    assert response.status_code == 200, f"Upload analysis failed: {response.text}"
    data = response.json()
    print(f"  Uploaded Scenario ID: {data['scenario_id']}")
    print(f"  Detection Confidence: {data['slick']['oil_likelihood_confidence'] * 100:.1f}%")
    print(f"  Metocean Source: {data['metadata'].get('metocean_source')}")
    print(f"  Top Candidate: {data['candidates'][0]['vessel_name']} - Score: {data['candidates'][0]['total_score']}")
    assert data["candidates"][0]["total_score"] > 0.70
    print("  [PASSED] Image upload analysis endpoint verified.")

if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING FASTAPI ENDPOINT INTEGRATION TESTS")
    print("=" * 60)
    test_health()
    test_presets()
    test_run_default()
    test_run_presets()
    test_upload_image()
    print("\n" + "=" * 60)
    print("ALL API TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

