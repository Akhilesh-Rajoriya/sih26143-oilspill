# Product Requirements Document (PRD)

**Project:** Automated Satellite Oil Spill Detection, Drift Trajectory Modeling & AIS Vessel Attribution  
**Problem Statement:** PS-143 (Smart India Hackathon)  
**Sponsor Organization:** National Technical Research Organisation (NTRO)  
**Category:** Software / Space Technology / Maritime Surveillance  

---

## 1. Executive Summary & Vision

Marine oil spills cause catastrophic, long-term ecological damage and economic disruption to coastal waters. Most illegal discharges (tanker bilge washing, operational dumping) and accidental spills in the Indian Exclusive Economic Zone (EEZ) go unattributed due to lack of an integrated operational pipeline.

This system establishes an end-to-end intelligence pipeline that:
1. **Detects** dark-spot oil slicks in Sentinel-1 Synthetic Aperture Radar (SAR) imagery.
2. **Reconstructs** the historical origin of the spill (hindcast) and predicts future shoreline impact (forecast) using hydrodynamic ocean currents and atmospheric wind models.
3. **Correlates** the origin spatio-temporal window with historical Automatic Identification System (AIS) vessel traffic to output a ranked, explainable list of suspect vessels.

---

## 2. Target Users & Stakeholders

| User Persona | Role & Objectives | Key Needs |
|---|---|---|
| **NTRO Maritime Analysts (Primary)** | Geospatial intelligence, offshore monitoring, automated alert triage | High-confidence leads, multi-sensor correlation, anomaly flags |
| **Indian Coast Guard / Maritime Police** | Interception, evidence collection, enforcement | Rapid response time, exportable legal-grade evidence reports |
| **Port Authorities & Pollution Control Boards** | Shoreline cleanup planning, containment asset dispatch | Accurate 24–72h forecast trajectory, coastal vulnerability overlay |

---

## 3. Core Principles & Design Commitment

> **Probability Ranking vs. Defamatory Verdict:**  
> Every input in this pipeline carries inherent uncertainty:
> - SAR detection faces look-alikes (biogenic slicks, low-wind calm zones).
> - Hydrodynamic models accumulate drift positional error over time.
> - AIS feeds suffer from transmission latency, line-of-sight gaps, or deliberate transponder disabling (dark vessels).
> 
> Therefore, the system outputs **scored candidate vessels with sub-scores, confidence intervals, and anomaly flags**, serving as an intelligence and decision-support tool rather than an automated accusation.

---

## 4. Functional Requirements (FR)

### FR-1: SAR Slick Detection & Geometry Extraction
- **FR-1.1:** Ingest Sentinel-1 SAR GRD products (IW mode, VV/VH polarizations).
- **FR-1.2:** Implement adaptive thresholding / deep learning segmentation to detect dark patches on sea surface.
- **FR-1.3:** Filter false-positive look-alikes (biogenic slicks, low wind calm water, internal waves) using texture, elongation ratio, and contextual wind speed.
- **FR-1.4:** Extract slick polygon geometry, centroid `(lat, lon)`, area ($\text{km}^2$), perimeter, and estimate slick weathering/age class (`fresh`, `moderate`, `weathered`).

### FR-2: Metocean Environmental Data Ingestion
- **FR-2.1:** Automated retrieval of 10m surface wind vectors $(u, v)$ from ECMWF ERA5 via CDS API.
- **FR-2.2:** Automated retrieval of hourly total surface currents $(u, v)$ (circulation + tide + Stokes drift) from Copernicus Marine Service (CMEMS SMOC product).
- **FR-2.3:** Dynamic spatial bounding box and temporal window calculation based on slick detection timestamp and location.

### FR-3: Hydrodynamic Drift Simulation (Hindcast & Forecast)
- **FR-3.1 (Hindcast):** Backward-in-time Lagrangian particle tracking using 20-particle Monte Carlo ensemble with turbulent diffusion. Outputs `OriginWindow` (center coordinate, radius, temporal window, confidence).
- **FR-3.2 (Forecast):** Forward-in-time Lagrangian particle tracking (10-particle ensemble) over 24–72 hours to predict slick movement, beaching risk, and path uncertainty expansion.
- **FR-3.3 (High Performance):** Simulation loop must execute in under 1 second per run using pre-loaded vectorized spatial lookups.

### FR-4: AIS Spatio-Temporal Ingestion & Correlation
- **FR-4.1:** Query AIS historic trajectories within the computed `OriginWindow` spatial radius and time window.
- **FR-4.2:** Support synthetic AIS generator and real historical AIS datasets (MMSI, vessel type, timestamp, SOG, COG, lat, lon).
- **FR-4.3:** Interpolate vessel tracks across sparse AIS transmission points.

### FR-5: Vessel Scoring & Anomaly Detection
- **FR-5.1:** Compute `proximity_score` $\in [0, 1]$ based on minimal distance between vessel track and computed origin window center.
- **FR-5.2:** Compute `trajectory_score` $\in [0, 1]$ evaluating vessel heading alignment and course consistency with the spill elongation.
- **FR-5.3:** Compute `anomaly_score` $\in [0, 1]$ detecting suspicious behaviors (drastic speed drops, loitering, zig-zag maneuvering, AIS dark gaps near the origin window).
- **FR-5.4:** Rank candidate vessels by composite `total_score` and list descriptive `anomaly_flags`.

### FR-6: Interactive Dashboard & Decision Support
- **FR-6.1:** Interactive web map displaying SAR detection polygons, hindcast origin uncertainty circles, forecast trajectory cones, and colored AIS vessel tracks.
- **FR-6.2:** Time-scrubber slider to animate particle drift and vessel movements synchronously.
- **FR-6.3:** Candidate vessel inspection drawer displaying score breakdown, vessel metadata, and anomaly alerts.
- **FR-6.4:** PDF/GeoJSON intelligence report export for Coast Guard dispatch.

---

## 5. Non-Functional Requirements (NFR)

- **Performance:** End-to-end pipeline run (from detection input to vessel scoring) in $< 5\text{ seconds}$ once environmental files are cached.
- **Reliability & Graceful Degradation:** Physics simulation must handle coastline boundaries and particle beaching gracefully without crashing.
- **Explainability:** All vessel scores must be mathematically decomposable into their constituent sub-scores.
- **Scalability:** Modular architecture allowing plug-and-play replacement of SAR detectors or AIS providers.

---

## 6. Success Metrics & Evaluation Criteria

1. **Attribution Accuracy:** Suspect vessel ranked in top 3 candidates for benchmark scenarios.
2. **Drift Accuracy:** Origin window radius capturing true spill source within 95% confidence bounds.
3. **Execution Latency:** Sub-second physics simulation allowing real-time interactive parameter adjustments in the UI.
4. **UI/UX Usability:** Clear visual distinction between certainty levels and actionable exportable intelligence.
