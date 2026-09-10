# SIH-26143: Frontend Technology Stack & Tactical UI Architecture

**Problem Statement 143** — National Technical Research Organisation (NTRO) | Space & Maritime Technology  
**Component:** 4D Tactical Command & Geospatial Operations Center (Frontend UI)

---

## 1. Executive Summary & Design Philosophy

The frontend of the **SIH-26143 Maritime Oil Spill Surveillance System** is architected as a **military-grade, dark-mode Tactical Operations Center (TOC)**. 

Unlike standard dashboards that present static charts and tables, this interface functions as a **high-frequency 4D Geospatial Command Center**. It dynamically visualizes satellite Synthetic Aperture Radar (SAR) detections, executes real-time 4D advection animation of oil slicks along ocean currents, renders animated historical Automatic Identification System (AIS) vessel trajectories, and exports legal-grade incident dossiers for Coast Guard enforcement.

---

## 2. Master Frontend Technology Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TACTICAL DASHBOARD UI                                     │
│  React 19  │  TypeScript  │  Vite 8  │  Tailwind CSS  │  Leaflet / React-Leaflet  │ Lucide  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ Axios HTTP Client
┌──────────────────────────────────────────────▼──────────────────────────────────────────────┐
│                               FASTAPI BACKEND & PYTORCH ENGINE                              │
│         /api/v1/scenarios/run-preset  │  /api/v1/scenarios/analyze-image  │  /health        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Dependency Breakdown (from `frontend/package.json`):

| Package / Resource | Version | Category | Primary Function in the Project | Why It Was Chosen |
| :--- | :--- | :--- | :--- | :--- |
| **`react`** | `^19.2.8` | Core UI Framework | Component hierarchy, reactive state management, and real-time DOM updates. | Industry standard for building high-performance Single Page Applications (SPAs). React 19 provides ultra-fast concurrent rendering, eliminating UI stutter during continuous map and vector repaints. |
| **`typescript`** | `~6.0.2` | Programming Language | Compile-time type checking and strict interface enforcement. | Eliminates runtime bugs. Strictly types complex geospatial telemetry models (`SlickDetection`, `OriginWindow`, `CandidateVessel`, `ForecastPath`). |
| **`vite`** | `^8.2.2` | Build Tool & Bundler | Development server and production bundling with Rollup. | Blazing-fast Hot Module Replacement (HMR) during development; compiles production bundle in **$1.3\text{ seconds}$** with automatic tree-shaking and asset minification. |
| **`leaflet`** | `^1.9.4` | Geospatial GIS Engine | Interactive map rendering, tile loading, coordinate projection, and vector layers. | Ultra-lightweight ($\approx 40\text{ KB}$), hardware-accelerated 2D canvas/SVG rendering, buttery smooth panning/zooming, and zero third-party commercial API key requirements (unlike Google Maps or Mapbox). |
| **`react-leaflet`** | `^5.0.0` | React GIS Wrapper | Declarative React bindings for Leaflet elements (`<MapContainer>`, `<Polygon>`, `<Circle>`, `<Polyline>`, `<Marker>`). | Allows GIS layers to be controlled declaratively through React state (e.g., updating slick position or ship markers directly when the timeline scrubber moves). |
| **`geotiff`** | `^3.0.5` | In-Browser Raster Parser | Client-side parsing of raw GeoTIFF metadata, bounding boxes, and raster channels. | Enables users to drag and drop real Sentinel-1 `.tif` satellite files and instantly inspect resolution, bounds, and channels directly in the browser before sending them to the backend. |
| **`tailwindcss`** | `^3.4.19` | Utility-First CSS | Complete design system, maritime dark-theme palette, glassmorphism, responsive grids. | Allows rapid, consistent styling without leaving the component code. Native support for `@media print` enables seamless transition between dark tactical screen mode and clean white legal PDF dossiers. |
| **`clsx` & `tailwind-merge`** | `^2.1` / `^3.6` | Dynamic Class Utility | Conditional class joining and intelligent deduplication of conflicting Tailwind utilities. | Prevents CSS specificity conflicts when combining dynamic state classes (e.g., pulsing alert states, suspect rank colors). |
| **`lucide-react`** | `^1.43.0` | Iconography System | Crisp tactical vector icons (radar, anchor, ship, shield, warning triangle, print). | Clean, modern SVG icons with zero runtime bloat, matching defense and maritime command center visual standards. |
| **`axios`** | `^1.20.0` | Network & API Client | Promise-based HTTP client for backend REST API communication. | Reliable handling of multipart/form-data for heavy satellite GeoTIFF uploads, automatic JSON response parsing, timeout handling, and custom request interceptors. |
| **`oxlint`** | `^1.79.0` | Next-Gen Linter | High-speed Rust-based code linter for TypeScript and React. | Runs static code quality and lint analysis 50–100× faster than legacy ESLint, guaranteeing zero syntax errors. |

---

## 3. Detailed Architectural Rationale: Why These Technologies?

### 3.1 Why Leaflet & React-Leaflet (Over Google Maps or Mapbox)?
1. **Zero API Key Requirements & Zero Cost**:
   - Google Maps and Mapbox require active billing accounts, credit cards, restricted API keys, and have strict query quotas.
   - Leaflet is 100% open-source, community-maintained, and operates freely without rate limits.
2. **CartoDB Dark Matter Maritime Basemap**:
   - Uses CartoDB Dark Matter tiles: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`.
   - Creates a high-contrast dark military command aesthetic where neon oil slicks (cyan), AIS vessel tracks (amber/emerald), and origin uncertainty circles (red) stand out with maximum visibility.
3. **High-Frequency 60 FPS Vector Re-rendering**:
   - When the user drags the temporal timeline scrubber, the map dynamically re-computes the positions of 5 ships, their course headings, and the advected oil slick polygon. Leaflet's lightweight SVG/Canvas rendering layer handles this high-frequency update smoothly without dropped frames.

---

### 3.2 Why Tailwind CSS with Custom Maritime Color Palette?
The interface uses a custom-configured tactical color scheme defined in `frontend/tailwind.config.js`:
* `bg-[#050811]` / `bg-slate-950`: Ultra-dark navy-black backdrop simulating a physical maritime operations room.
* `text-cyan-400` / `border-cyan-500`: Radar surveillance accents.
* `text-amber-400` / `bg-amber-500/20`: Moderate maritime warning indicators.
* `text-red-500` / `bg-red-500/20`: Critical alerts (Prime Suspect, AIS transponder blackout, illegal discharge).
* `backdrop-blur-md` (Glassmorphism): Translucent frosted panels that float over the map without occluding surrounding oceanic context.

---

### 3.3 Why Client-Side `geotiff` Parsing?
Standard web browsers cannot natively display or decode 16-bit satellite GeoTIFF (`.tif`) files. By bundling the `geotiff` JavaScript library:
- When a user drops a raw Sentinel-1 SAR scene into the upload modal, the browser reads its embedded tags, coordinate system, and raster dimensions instantly on the client side before uploading.
- Provides immediate visual feedback to the user on image dimensions, CRS format, and file integrity.

---

## 4. Key Frontend Components & Capabilities

### 4.1 `Navbar.tsx` (Tactical Top Operations Bar)
* **Live System Telemetry**: Displays the active backend health badge, **CUDA GPU acceleration status** (`NVIDIA GeForce RTX 3050`), and model execution latency ($< 1.7\text{s}$).
* **Scenario Preset Selector**: Allows instant switching between **Mumbai Coast**, **Gulf of Kutch**, **Ennore / Chennai**, and **Global Maritime Corridor (Strait of Hormuz)**.
* **Action Buttons**: "Analyze SAR" (opens upload modal) and cyan "Dossier" (opens legal evidence export).
* **Responsive Layout**: Designed with `h-[68px]` and responsive visibility rules (`sm:inline`, `xl:inline`) to eliminate text truncation across screen sizes.

---

### 4.2 `TacticalMap.tsx` (Geospatial GIS Core)
* **Dynamic Oil Slick Polygon**: Renders the multi-vertex oil contour detected by the U-Net model. When the scrubber moves, it advects along the metocean flow vectors.
* **Origin Uncertainty Circle**: A red dashed bounding circle showing the calculated release zone ($R_{\text{origin}}$) with 95% Bayesian confidence.
* **Animated AIS Ship Routes**: Renders candidate vessel tracks as color-coded polylines with directional arrows. The active position of each ship sails along its trajectory in sync with the selected hour.
* **Custom SVG Vessel Icons**: Renders custom ship silhouettes that rotate to match the vessel’s Course Over Ground (COG).

---

### 4.3 `TemporalScrubber.tsx` (4D Interactive Playback Bar)
* Spans **$-72\text{ hours}$ (hindcast origin)** $\rightarrow$ **$T_0$ (detection)** $\rightarrow$ **$+48\text{ hours}$ (forward forecast)**.
* Features Play/Pause controls, step forward/backward buttons, speed multipliers ($1\times, 2\times, 5\times$), and formatted milestone badges.
* As the user drags the slider, an event updates `timeOffsetHours`, triggering real-time mathematical interpolation across the map.
* Built with `h-[72px]`, `whitespace-nowrap`, and robust overflow guards to prevent milestone line wrapping.

---

### 4.4 `SuspectTriagePanel.tsx` (Right-Hand Intelligence Sidebar)
* Lists candidate vessels sorted by composite probability score (Rank #1 to #5).
* Shows **sub-score breakdown progress meters**:
  - **Proximity**: How close the ship passed to the discharge origin.
  - **Trajectory**: Course alignment with slick drift.
  - **Anomaly**: Transponder silence and speed drops.
* Displays distinct warning badges for flagged violations: `AIS Silence: 4.0h gap` and `Sudden Deceleration: 14.2 kts -> 3.2 kts`.

---

### 4.5 `IncidentDossier.tsx` (Official Legal Evidence Brief)
* **On-Screen Modal**: Clicking "Dossier" displays an official Indian Coast Guard investigation report.
* **Print-Optimized (`@media print`)**: When the user clicks "Print / Save PDF" (or presses `Ctrl + P`), it hides all dark screen panels and prints a **clean, white-background A4 legal dossier** with:
  - Official Government & Coast Guard headers.
  - Case metadata and radar specifications.
  - Metocean origin coordinates and confidence radius.
  - Candidate vessel table and anomaly evidence logs.
  - Chain-of-custody checksum hash and officer sign-off lines.

---

### 4.6 `UploadModal.tsx` (Custom SAR Scene Uploader)
* Drag-and-drop zone accepting `.tif`, `.png`, and `.jpg` satellite images.
* Allows manual bounding box overrides or automatic extraction from embedded GeoTIFF coordinates.
* Automatically registers custom uploaded scenes (e.g., `Scene 00001`, `Scene 00004`) as new selectable maritime sectors without restarting the server.

---

## 5. Build, Bundling & Performance Metrics

* **Bundler**: Vite 8 with Rollup.
* **Build Time**: **$1.33\text{ seconds}$** (`npm run build`).
* **Bundle Size**:
  - Total production JavaScript: $\sim 512\text{ KB}$ ($\approx 157\text{ KB}$ gzipped).
  - Total production CSS: $\sim 43\text{ KB}$ ($\approx 12\text{ KB}$ gzipped).
* **Single-Port Production Serving**:
  FastAPI directly mounts `frontend/dist` at `/`, serving both the REST API and the React production bundle from a single unified port (`http://localhost:8000`).
