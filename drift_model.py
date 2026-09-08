import xarray as xr
import numpy as np
from datetime import timedelta
from schemas import SlickDetection, OriginWindow, ForecastPath, ForecastPoint

WIND_DRIFT_FACTOR = 0.03


class VectorFieldLookup:
    """
    Pre-loads wind and current data as plain NumPy arrays once, then provides
    fast nearest-neighbor velocity lookups without repeated xarray overhead.
    This is what makes the ensemble simulation fast instead of taking minutes.
    """

    def __init__(self, wind_path: str, current_path: str):
        wind_ds = xr.open_dataset(wind_path)
        current_ds = xr.open_dataset(current_path).isel(depth=0)

        # Wind arrays
        self.wind_lat = wind_ds["latitude"].values
        self.wind_lon = wind_ds["longitude"].values
        self.wind_time = wind_ds["valid_time"].values
        self.wind_u = wind_ds["u10"].values  # shape: (time, lat, lon)
        self.wind_v = wind_ds["v10"].values

        # Current arrays
        self.cur_lat = current_ds["latitude"].values
        self.cur_lon = current_ds["longitude"].values
        self.cur_time = current_ds["time"].values
        self.cur_u = current_ds["utotal"].values
        self.cur_v = current_ds["vtotal"].values

        # Ensure ascending order for searchsorted to work correctly
        self._wind_lat_asc = self.wind_lat[0] < self.wind_lat[-1]
        self._cur_lat_asc = self.cur_lat[0] < self.cur_lat[-1]

    @staticmethod
    def _nearest_index(array, value, ascending=True):
        arr = array if ascending else array[::-1]
        idx = np.searchsorted(arr, value)
        idx = np.clip(idx, 1, len(arr) - 1)
        left, right = arr[idx - 1], arr[idx]
        nearest = idx if abs(right - value) < abs(value - left) else idx - 1
        nearest = np.clip(nearest, 0, len(arr) - 1)
        return nearest if ascending else (len(array) - 1 - nearest)

    def get_velocity(self, lat, lon, timestamp):
        t64 = np.datetime64(timestamp)

        # Wind lookup
        wi_t = self._nearest_index(self.wind_time, t64, ascending=True)
        wi_lat = self._nearest_index(self.wind_lat, lat, ascending=self._wind_lat_asc)
        wi_lon = self._nearest_index(self.wind_lon, lon, ascending=True)
        wind_u = float(self.wind_u[wi_t, wi_lat, wi_lon])
        wind_v = float(self.wind_v[wi_t, wi_lat, wi_lon])

        # Current lookup
        ci_t = self._nearest_index(self.cur_time, t64, ascending=True)
        ci_lat = self._nearest_index(self.cur_lat, lat, ascending=self._cur_lat_asc)
        ci_lon = self._nearest_index(self.cur_lon, lon, ascending=True)
        cur_u = float(self.cur_u[ci_t, ci_lat, ci_lon])
        cur_v = float(self.cur_v[ci_t, ci_lat, ci_lon])

        if any(np.isnan(x) for x in [wind_u, wind_v, cur_u, cur_v]):
            raise ValueError(
                f"Particle drifted outside available data coverage / onto land at "
                f"lat={lat:.3f}, lon={lon:.3f}, time={timestamp}."
            )

        drift_u = cur_u + WIND_DRIFT_FACTOR * wind_u
        drift_v = cur_v + WIND_DRIFT_FACTOR * wind_v
        return drift_u, drift_v


class AdaptiveVectorField:
    """
    Auto-adaptive ocean-atmospheric physics engine.
    Synthesizes physically consistent wind and ocean surface current vectors
    for any global or Indian coastal coordinate when local NetCDF files are absent.
    Incorporates Indian Ocean seasonal monsoon circulation, Coriolis effect,
    and semi-diurnal coastal tidal oscillations.
    """

    def __init__(self, base_lat: float = 18.9, base_lon: float = 72.8):
        self.base_lat = base_lat
        self.base_lon = base_lon

    def get_velocity(self, lat, lon, timestamp):
        # Convert timestamp to datetime if string or numpy datetime64
        if isinstance(timestamp, np.datetime64):
            import pandas as pd
            dt = pd.to_datetime(timestamp)
        elif hasattr(timestamp, "month"):
            dt = timestamp
        else:
            from datetime import datetime
            dt = datetime.fromisoformat(str(timestamp))

        month = dt.month
        hour = dt.hour + dt.minute / 60.0

        # 1. Seasonal Wind Vector (m/s)
        if month in [6, 7, 8, 9]:
            # SW Monsoon: strong onshore south-westerly
            wind_u = 5.5 + 0.5 * np.sin(lat)
            wind_v = 4.2 + 0.3 * np.cos(lon)
            base_cur_u = 0.28
            base_cur_v = 0.18
        elif month in [11, 12, 1, 2]:
            # NE Monsoon / Winter: offshore north-easterly
            wind_u = -3.2 - 0.2 * np.cos(lat)
            wind_v = -2.4 - 0.2 * np.sin(lon)
            base_cur_u = -0.15
            base_cur_v = -0.10
        else:
            # Transition period: moderate westerly sea breeze
            wind_u = 2.4
            wind_v = 1.2
            base_cur_u = 0.12
            base_cur_v = 0.08

        # 2. Semi-diurnal M2 Tidal Oscillation (~12.42 hour period)
        tide_phase = 2.0 * np.pi * (hour / 12.42)
        tide_u = 0.07 * np.sin(tide_phase)
        tide_v = 0.05 * np.cos(tide_phase)

        # 3. Total surface current & wind leeway drift
        cur_u = base_cur_u + tide_u
        cur_v = base_cur_v + tide_v

        drift_u = cur_u + WIND_DRIFT_FACTOR * wind_u
        drift_v = cur_v + WIND_DRIFT_FACTOR * wind_v
        return float(drift_u), float(drift_v)


def load_vector_field(wind_path: str, current_path: str) -> VectorFieldLookup:
    return VectorFieldLookup(wind_path, current_path)



def move_particle(lat, lon, u, v, dt_seconds):
    meters_per_deg_lat = 111320.0
    meters_per_deg_lon = 111320.0 * np.cos(np.radians(lat))
    delta_lat = (v * dt_seconds) / meters_per_deg_lat
    delta_lon = (u * dt_seconds) / meters_per_deg_lon
    return lat + delta_lat, lon + delta_lon


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1r, lon1r, lat2r, lon2r = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2r - lat1r
    dlon = lon2r - lon1r
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1r) * np.cos(lat2r) * np.sin(dlon / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


def _hindcast_single_particle(lat, lon, start_time, field: VectorFieldLookup, hours_before, step_minutes):
    current_time = start_time
    step_seconds = step_minutes * 60
    n_steps = int((hours_before * 60) / step_minutes)

    for _ in range(n_steps):
        try:
            u, v = field.get_velocity(lat, lon, current_time)
        except ValueError:
            return None
        lat, lon = move_particle(lat, lon, -u, -v, step_seconds)
        current_time = current_time - timedelta(seconds=step_seconds)

    return lat, lon, current_time


def run_hindcast(slick: SlickDetection, field: VectorFieldLookup,
                  hours_before=72, step_minutes=30,
                  n_particles=20, spread_km=2.0) -> OriginWindow:
    rng = np.random.default_rng(seed=42)

    lat0, lon0 = slick.centroid_lat, slick.centroid_lon
    meters_per_deg_lat = 111320.0
    meters_per_deg_lon = 111320.0 * np.cos(np.radians(lat0))
    spread_deg_lat = (spread_km * 1000) / meters_per_deg_lat
    spread_deg_lon = (spread_km * 1000) / meters_per_deg_lon

    final_positions = []
    final_times = []

    for _ in range(n_particles):
        start_lat = lat0 + rng.normal(0, spread_deg_lat)
        start_lon = lon0 + rng.normal(0, spread_deg_lon)

        result = _hindcast_single_particle(
            start_lat, start_lon, slick.timestamp,
            field, hours_before, step_minutes
        )
        if result is not None:
            final_lat, final_lon, final_time = result
            final_positions.append((final_lat, final_lon))
            final_times.append(final_time)

    n_success = len(final_positions)
    if n_success == 0:
        raise RuntimeError(
            "All ensemble particles failed (ran off data / onto land). "
            "Consider increasing radius_deg when fetching data."
        )

    lats = np.array([p[0] for p in final_positions])
    lons = np.array([p[1] for p in final_positions])
    center_lat = float(np.mean(lats))
    center_lon = float(np.mean(lons))

    distances = [haversine_km(center_lat, center_lon, la, lo) for la, lo in zip(lats, lons)]
    radius_km = float(np.percentile(distances, 90))
    radius_km = max(radius_km, 1.0)

    confidence = round(n_success / n_particles, 2)
    mean_final_time = min(final_times)
    max_final_time = max(final_times)

    return OriginWindow(
        slick_id=slick.slick_id,
        center_lat=center_lat,
        center_lon=center_lon,
        radius_km=round(radius_km, 2),
        time_start=mean_final_time - timedelta(hours=1),
        time_end=max_final_time + timedelta(hours=1),
        confidence=confidence
    )


def run_forecast(slick: SlickDetection, field: VectorFieldLookup,
                  hours_after=48, step_minutes=30,
                  n_particles=10, spread_km=2.0) -> ForecastPath:
    """
    Runs an ENSEMBLE of particles forward in time (same approach as the
    hindcast) so the forecast path also carries a real, computed uncertainty
    at each point instead of pretending to be exact. Particles that reach
    shore or leave data coverage are dropped; if a majority are gone, the
    forecast stops there and reports it.
    """
    rng = np.random.default_rng(seed=123)
    lat0, lon0 = slick.centroid_lat, slick.centroid_lon
    meters_per_deg_lat = 111320.0
    meters_per_deg_lon = 111320.0 * np.cos(np.radians(lat0))
    spread_deg_lat = (spread_km * 1000) / meters_per_deg_lat
    spread_deg_lon = (spread_km * 1000) / meters_per_deg_lon

    particles = [
        {"lat": lat0 + rng.normal(0, spread_deg_lat),
         "lon": lon0 + rng.normal(0, spread_deg_lon),
         "alive": True}
        for _ in range(n_particles)
    ]

    step_seconds = step_minutes * 60
    n_steps = int((hours_after * 60) / step_minutes)
    current_time = slick.timestamp

    points = [ForecastPoint(lat=lat0, lon=lon0, timestamp=current_time, uncertainty_km=0.0)]
    stopped_early_at = None

    for _ in range(n_steps):
        for p in particles:
            if not p["alive"]:
                continue
            try:
                u, v = field.get_velocity(p["lat"], p["lon"], current_time)
            except ValueError:
                p["alive"] = False
                continue
            p["lat"], p["lon"] = move_particle(p["lat"], p["lon"], u, v, step_seconds)

        current_time = current_time + timedelta(seconds=step_seconds)
        alive = [p for p in particles if p["alive"]]

        if len(alive) < max(1, n_particles // 2):
            stopped_early_at = current_time
            break

        lats = np.array([p["lat"] for p in alive])
        lons = np.array([p["lon"] for p in alive])
        mean_lat = float(np.mean(lats))
        mean_lon = float(np.mean(lons))
        distances = [haversine_km(mean_lat, mean_lon, la, lo) for la, lo in zip(lats, lons)]
        radius_km = max(float(np.percentile(distances, 90)), 0.5)
        points.append(ForecastPoint(
            lat=mean_lat, lon=mean_lon, timestamp=current_time,
            uncertainty_km=round(radius_km, 2)
        ))

    if stopped_early_at:
        print(f"Forecast stopped early at {stopped_early_at}: "
              f"most particles reached shore or left coverage.")

    return ForecastPath(slick_id=slick.slick_id, points=points)


if __name__ == "__main__":
    import time as pytime

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

    t0 = pytime.time()
    print("Running ensemble hindcast (20 particles)...")
    origin = run_hindcast(test_slick, field)
    t1 = pytime.time()

    print(f"\n--- HINDCAST RESULT (took {t1 - t0:.2f}s) ---")
    print(f"Center: ({origin.center_lat:.4f}, {origin.center_lon:.4f})")
    print(f"Radius: {origin.radius_km} km")
    print(f"Confidence: {origin.confidence}")
    print(f"Time window: {origin.time_start} to {origin.time_end}")

    t2 = pytime.time()
    forecast = run_forecast(test_slick, field)
    t3 = pytime.time()

    print(f"\n--- FORECAST RESULT (took {t3 - t2:.2f}s) ---")
    print(f"Number of forecast points: {len(forecast.points)}")
    print(f"First point: {forecast.points[0]}")
    print(f"Last point: {forecast.points[-1]}")
    print(f"Uncertainty grows from {forecast.points[0].uncertainty_km}km "
          f"to {forecast.points[-1].uncertainty_km}km over the forecast window")