# UI/UX & System Design Specifications

**Project:** Automated Satellite Oil Spill Detection & Maritime Intelligence Dashboard  
**Document:** Frontend, Visual & Interaction Design System  

---

## 1. Design Philosophy & Aesthetic Guidelines

The dashboard is designed for high-stress, rapid-response maritime operations by intelligence officers and coast guard coordinators.

- **Theme:** Ultra-sleek Maritime Dark Mode (Deep Navy `#0a0f1d`, Slate `#1e293b`, Cyber Amber/Cyan accents).
- **Visual Clarity:** High-contrast GIS layers with glowing vectors and distinct uncertainty bands.
- **Glassmorphism & Micro-animations:** Frosted dark cards (`backdrop-filter: blur(12px)`), smooth slide-in panels, and fluid timeline scrubbing.
- **No Ambiguity:** Probabilities and uncertainty radii are visually explicit—never misleadingly precise.

---

## 2. Color Palette & Visual Hierarchy

| Element | Hex Code | Purpose / Usage |
|---|---|---|
| **Background Primary** | `#070b14` | Deep oceanic base background |
| **Surface Card** | `rgba(15, 23, 42, 0.85)` | Glassmorphic floating panels |
| **Border / Divider** | `rgba(148, 163, 184, 0.15)` | Subtle slate panel borders |
| **Oil Slick (Detection)** | `#ef4444` / Crimson Glow | SAR detection polygon & centroid marker |
| **Hindcast Origin Window** | `#f59e0b` / Amber Ring | Source uncertainty circle & origin particles |
| **Forecast Trajectory** | `#06b6d4` / Cyan Cone | Predicted slick movement path & spread |
| **Top Suspect Vessel** | `#dc2626` / Red Marker | Rank #1 highest correlated candidate |
| **Candidate Vessel (Normal)** | `#3b82f6` / Blue Marker | Other candidate vessels within origin window |
| **Non-suspect Traffic** | `#64748b` / Muted Slate | Background maritime AIS tracks |

---

## 3. UI Layout & Component Hierarchy

```
+-----------------------------------------------------------------------------------+
|  [Logo] MARITIME OIL SPILL INTELLIGENCE PLATFORM           [Status: Active] [Export] |
+-----------------------------------------------------------------------------------+
|  SIDEBAR (320px)      |  MAIN GIS MAP VIEWPORT (Leaflet / MapLibre)               |
|  -------------------  |  -------------------------------------------------------  |
|  Active Incident:     |                                                           |
|  • Slick ID: SLK-2024 |       [Forecast Path 48h (Cyan Cone)]                     |
|  • Lat/Lon: 18.9, 72.8|              ^                                            |
|  • Area: 14.2 km²     |              |                                            |
|  • Age: Moderate      |       (Slick Detected - Red Polygon)                      |
|                       |              ^                                            |
|  Suspect Vessels:     |              |                                            |
|  1. MT ARGO (92%) [!] |       (Origin Window - Amber Circle)                      |
|     S_p: 0.94 | S_t: 0.9      [Vessel Track: MMSI 419001234 (Red)]                |
|     Flags: [Dark Gap] |                                                           |
|  2. MV PACIFIC (71%)  |                                                           |
|  3. TANKER GULF (48%) |                                                           |
|                       +-----------------------------------------------------------+
|  [Simulate New Scene] |  TIMELINE SCRUBBER & PLAYBACK CONTROLS                    |
|  [Download Dossier]   |  [-24h Hindcast] -------- [Detection: T0] -------- [+48h]  |
+-----------------------------------------------------------------------------------+
```

---

## 4. Key Interactive Components

### 4.1 Temporal Scrubber Bar (Bottom Control)
- Multi-phase timeline slider spanning from $T_{-48\text{h}}$ (hindcast start) to $T_0$ (SAR detection) to $T_{+72\text{h}}$ (forecast impact).
- Play / Pause button with speed multiplier ($1\times, 5\times, 20\times$).
- Synchronized animation: particles move backwards/forwards while vessel markers trace along their historical AIS paths.

### 4.2 Candidate Vessel Inspection Drawer (Right / Side Panel)
- Displays full radar chart / bar breakdown of:
  - **Proximity Score:** Distance of closest approach ($d_{\min}$).
  - **Trajectory Score:** Heading alignment with slick elongation.
  - **Anomaly Flags:** e.g., `"AIS Transponder off for 42 mins"`, `"Sudden speed drop: 14.2 kn -> 2.1 kn"`.
- One-click button: **"Export Evidence Dossier (PDF)"**.

### 4.3 Metocean & Layer Switcher (Top Right Overlay)
- Toggleable map layers:
  - ERA5 10m Wind streamlines (animated flow arrows).
  - CMEMS Surface Ocean Current vectors (color-coded by current speed).
  - High-resolution SAR backscatter raster overlay.
  - Indian EEZ & Marine Protected Areas boundaries.

---

## 5. Responsive & Operational States

1. **Initial / Ingestion State:** Displays SAR scene upload, status of ERA5 & CMEMS fetchers, loading skeletons.
2. **Simulation Running State:** Micro-animations indicating particle ensemble propagation.
3. **Intelligence Result State:** Highlighted suspect list with interactive click-to-focus on map.
4. **Offline / Fallback State:** Clear banner when running on cached local NetCDF files vs live API.
