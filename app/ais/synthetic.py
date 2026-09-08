"""
Synthetic AIS Track Generator for Indian Coastal Waters.
Generates realistic vessel tracks for simulation and offline evaluation,
featuring a ground-truth suspect tanker with intentional discharge anomalies,
along with multiple innocent commercial and fishing vessels.
"""
from datetime import datetime, timedelta
from typing import List
import numpy as np

from schemas import OriginWindow, AISTrack, AISPosition
from drift_model import haversine_km


def generate_synthetic_coastal_ais(origin: OriginWindow) -> List[AISTrack]:
    """
    Generates realistic synthetic vessel tracks around an OriginWindow.

    Scenario participants:
    1. 'MT Ocean Pioneer' (Crude Oil Tanker, MMSI 419001234) - Suspect:
       Direct intercept with origin circle during the release window,
       speed drop (14.2 -> 3.2 knots), and a 3.5h AIS transponder blackout.
    2. 'MV Bharat Star' (Container Ship, MMSI 419005678) - Innocent:
       Cruising at 18.5 kts along commercial lane, ~35 km away.
    3. 'Sagar Kanya' (Fishing Trawler, MMSI 419008912) - Innocent:
       Inshore trawling at 2.8 kts, ~48 km east near the coast.
    4. 'MV Arabian Carrier' (Bulk Carrier, MMSI 419003456) - Innocent:
       Crosses origin area, but 16 hours prior to estimated release window.
    5. 'OSV Malabar' (Offshore Support, MMSI 419007788) - Innocent:
       Platform supply vessel operating ~22 km away at 8.5 kts.
    """
    ref_time = origin.time_start if isinstance(origin.time_start, datetime) else datetime.fromisoformat(str(origin.time_start))
    tracks: List[AISTrack] = []

    # -------------------------------------------------------------
    # 1. Suspect: MT Ocean Pioneer (Tanker, MMSI 419001234)
    # -------------------------------------------------------------
    suspect_positions: List[AISPosition] = []
    # Start 6 hours before origin, southwest of origin
    start_lat = origin.center_lat - 0.35
    start_lon = origin.center_lon - 0.30
    
    # 12 hourly steps
    current_time = ref_time - timedelta(hours=5)
    for step in range(12):
        t = current_time + timedelta(hours=step)
        frac = step / 11.0
        # Progresses from SW to NE directly across the origin center at step 5 (t = ref_time)
        lat = start_lat + frac * 0.70
        lon = start_lon + frac * 0.60

        # Anomaly simulation:
        # At steps 4, 5 (crossing origin), speed slows down drastically from 14.0 kts to 3.2 kts
        if step in (4, 5):
            sog = 3.2
            cog = 42.0
        elif step in (6, 7, 8):
            # Transponder gap: ship turns off AIS for ~3 hours after release
            continue
        else:
            sog = 14.2
            cog = 45.0

        suspect_positions.append(
            AISPosition(
                lat=round(lat, 5),
                lon=round(lon, 5),
                timestamp=t,
                speed_over_ground=sog,
                course_over_ground=cog,
            )
        )

    tracks.append(
        AISTrack(
            mmsi="419001234",
            vessel_name="MT Ocean Pioneer",
            vessel_type="Crude Oil Tanker",
            positions=suspect_positions,
        )
    )

    # -------------------------------------------------------------
    # 2. Innocent: MV Bharat Star (Container Ship, MMSI 419005678)
    # -------------------------------------------------------------
    container_positions: List[AISPosition] = []
    c_start_lat = origin.center_lat - 0.40
    c_start_lon = origin.center_lon - 0.38  # ~38 km west
    for step in range(10):
        t = ref_time - timedelta(hours=4) + timedelta(hours=step)
        lat = c_start_lat + (step / 9.0) * 0.85
        lon = c_start_lon + (step / 9.0) * 0.05
        container_positions.append(
            AISPosition(
                lat=round(lat, 5),
                lon=round(lon, 5),
                timestamp=t,
                speed_over_ground=18.5,
                course_over_ground=355.0,
            )
        )
    tracks.append(
        AISTrack(
            mmsi="419005678",
            vessel_name="MV Bharat Star",
            vessel_type="Container Ship",
            positions=container_positions,
        )
    )

    # -------------------------------------------------------------
    # 3. Innocent: Sagar Kanya (Fishing Trawler, MMSI 419008912)
    # -------------------------------------------------------------
    trawler_positions: List[AISPosition] = []
    f_lat = origin.center_lat + 0.05
    f_lon = origin.center_lon + 0.45  # ~45 km east in coastal shelf
    rng = np.random.default_rng(123)
    for step in range(8):
        t = ref_time - timedelta(hours=3) + timedelta(hours=step)
        f_lat += rng.uniform(-0.01, 0.01)
        f_lon += rng.uniform(-0.01, 0.01)
        trawler_positions.append(
            AISPosition(
                lat=round(f_lat, 5),
                lon=round(f_lon, 5),
                timestamp=t,
                speed_over_ground=2.8,
                course_over_ground=float(rng.uniform(0, 360)),
            )
        )
    tracks.append(
        AISTrack(
            mmsi="419008912",
            vessel_name="Sagar Kanya",
            vessel_type="Fishing Trawler",
            positions=trawler_positions,
        )
    )

    # -------------------------------------------------------------
    # 4. Innocent: MV Arabian Carrier (Bulk Carrier, MMSI 419003456)
    # -------------------------------------------------------------
    # Crosses origin location, but 16 hours earlier (temporal mismatch)
    carrier_positions: List[AISPosition] = []
    earlier_time = ref_time - timedelta(hours=18)
    for step in range(8):
        t = earlier_time + timedelta(hours=step)
        lat = (origin.center_lat - 0.25) + (step / 7.0) * 0.50
        lon = (origin.center_lon - 0.20) + (step / 7.0) * 0.40
        carrier_positions.append(
            AISPosition(
                lat=round(lat, 5),
                lon=round(lon, 5),
                timestamp=t,
                speed_over_ground=12.5,
                course_over_ground=40.0,
            )
        )
    tracks.append(
        AISTrack(
            mmsi="419003456",
            vessel_name="MV Arabian Carrier",
            vessel_type="Bulk Carrier",
            positions=carrier_positions,
        )
    )

    # -------------------------------------------------------------
    # 5. Innocent: OSV Malabar (Offshore Support, MMSI 419007788)
    # -------------------------------------------------------------
    osv_positions: List[AISPosition] = []
    osv_lat = origin.center_lat + 0.22
    osv_lon = origin.center_lon + 0.10
    for step in range(8):
        t = ref_time - timedelta(hours=4) + timedelta(hours=step)
        osv_positions.append(
            AISPosition(
                lat=round(osv_lat + step * 0.005, 5),
                lon=round(osv_lon - step * 0.003, 5),
                timestamp=t,
                speed_over_ground=8.5,
                course_over_ground=290.0,
            )
        )
    tracks.append(
        AISTrack(
            mmsi="419007788",
            vessel_name="OSV Malabar",
            vessel_type="Offshore Supply Vessel",
            positions=osv_positions,
        )
    )

    return tracks

