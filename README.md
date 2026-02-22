# Six Rivers Africa — Landscape Health Intelligence Dashboard

**Research & Restoration Programme**
**Southern & Western Tanzania**

---

## Overview

The Landscape Health Intelligence Dashboard is a geospatial monitoring platform serving [Six Rivers Africa](https://sixriversafrica.org), a not-for-profit conservation initiative operating in southern and western Tanzania. The system provides continuous, reproducible, satellite-derived landscape health intelligence across two critical protected area zones — enabling evidence-based conservation decision-making for field teams, government authorities, and international funders.

This initiative is anchored in Six Rivers Africa's **Research & Restoration pillar**:

> *"Enhancing public awareness and accessibility to wildlife population dynamics and biodiversity auditing data, to inform decision-making."*

---

## Operational Zones

| Zone | Protected Area | Region | Authority | Indicative Area | Status |
|------|---------------|--------|-----------|-----------------|--------|
| **Zone 1** | Usangu Game Reserve / Ihefu Wetland | Mbeya, Mbarali District | TAWA | ~2,500 km² | Game Reserve |
| **Zone 1 (core)** | Ihefu Swamp Core | Mbeya, Mbarali District | TAWA | ~350 km² | Highest sensitivity sub-zone |
| **Zone 2** | Nyerere National Park (Selous Ecosystem) | Morogoro, Lindi, Ruvuma | TANAPA | ~30,893 km² | UNESCO World Heritage Site (1982) |

**Combined monitoring coverage: ~33,393 km²**

> **Boundary Notice:** All zone boundaries in this repository are indicative placeholders based on published descriptions (WDPA, conservation literature). They will be updated with authoritative shapefiles from TANAPA, TAWA, or Six Rivers Africa's own operational GIS once provided.

---

## Methodology

### Environmental Indicators

The dashboard tracks **eight satellite-derived landscape health indicators**, updated monthly for each zone independently:

| Indicator | Data Source | Resolution | Scientific Rationale |
|-----------|-----------|------------|---------------------|
| **NDVI** (Vegetation Greenness) | Sentinel-2 | 10 m | Vegetation productivity proxy; grazing pressure and habitat quality |
| **EVI** (Enhanced Vegetation Index) | MODIS MOD13Q1 | 250 m | Reduced canopy saturation bias; superior in dense miombo woodland |
| **NDWI** (Water Index) | Sentinel-2 | 10 m | Open water quantification; Ihefu wetland health monitoring |
| **Surface Water Dynamics** | JRC Global Surface Water | 30 m | Seasonal inundation tracking; Ihefu swamp extent |
| **Burn Scar Extent** | NASA FIRMS + MODIS MCD64A1 | 500 m / 1 km | Fire ecology monitoring; illegal burn detection |
| **Land Cover Change** | ESA WorldCover + Hansen GFC | 10 m / 30 m | Deforestation, agricultural expansion, wetland shrinkage |
| **Rainfall Anomaly** | CHIRPS v2.0 | ~5.5 km | Drought/flood context for vegetation signals |
| **Land Surface Temperature** | MODIS MOD11A2 | 1 km | Thermal stress on vegetation and wildlife |

### Baseline Comparison Framework

Every indicator is compared against:

1. **5-year monthly baseline (2018–2023)** — same calendar month mean
2. **Month-on-month trend** — prior period comparison
3. **Active alerts** — carried from previous reporting cycles

### Alert Thresholds

| Indicator | Condition | Severity |
|-----------|-----------|----------|
| NDVI / EVI | >15% below baseline, >2 km² extent | **MODERATE** |
| NDVI / EVI | >25% below baseline, >5 km² extent | **HIGH** |
| Active fire | Any detection within zone boundary | **HIGH** |
| Forest/woodland loss | >0.5 km² in 30-day window | **MODERATE** |
| Forest/woodland loss | >2.0 km² in 30-day window | **HIGH** |
| Surface water (Ihefu) | >25% deviation from seasonal norm | **MODERATE** |
| Rainfall (CHIRPS) | >40% deficit vs 30-year mean | **HIGH** |
| Land surface temperature | >3°C above monthly baseline | **MODERATE** |

**Ihefu Escalation Rule:** Any MODERATE alert within the Ihefu Swamp Core automatically escalates to HIGH — this inner wetland is disproportionately ecologically sensitive and irreplaceable.

**UNESCO Protocol:** Any HIGH alert within Nyerere NP must reference Tanzania's UNESCO World Heritage obligations in government and donor communications.

### Spatial Framework

| Parameter | Value |
|-----------|-------|
| Storage CRS | EPSG:4326 (WGS 84 Geographic) |
| Analysis CRS | EPSG:32736 (WGS 84 / UTM Zone 36S) |
| Display CRS | EPSG:3857 (Web Mercator) |
| File format | GeoPackage (primary) + Shapefile (exchange) |
| Zonal statistics | Google Earth Engine (polygon extraction masks) |
| Pixel resolution | 10 m (Sentinel-2) to 5.5 km (CHIRPS) depending on indicator |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA PIPELINE                             │
│  Google Earth Engine → CSV/GeoTIFF exports → Processing     │
│  Sentinel-2  |  MODIS  |  CHIRPS  |  FIRMS  |  JRC GSW     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              PROCESSING & ANALYSIS                           │
│  Python: data ingestion, validation, anomaly detection       │
│  Alert engine: threshold evaluation, Ihefu escalation        │
│  Report generator: structured monthly reports                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           VISUALISATION & REPORTING                          │
│  R Shiny dashboard: interactive maps + indicator charts      │
│  Leaflet.js: zone overlays, fire mapping, water extent       │
│  Automated PDF/HTML monthly reports                          │
│  Multi-audience output modes (donor, government, community)  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Tools |
|-------|-------|
| Satellite data | Google Earth Engine (GEE) |
| Processing | Python (pandas, numpy, geopandas) |
| Spatial | PostGIS / GeoPackage |
| Dashboard | R Shiny + Leaflet.js + Plotly |
| Reporting | Automated narrative generation |
| CI/CD | GitHub Actions (monthly pipeline) |
| Version control | Git (code) + versioned GeoPackage (spatial data) |

---

## Repository Structure

```
six_rivers_africa/
├── assets/                  # Project specification, maps, reference materials
├── config/
│   ├── zones.json           # Zone definitions, boundaries, thresholds
│   └── indicators.json      # Indicator metadata and GEE collection IDs
├── gee/
│   └── scripts/
│       ├── 00_zone_boundaries.js       # Zone geometry definitions
│       ├── 01_ndvi_evi_pipeline.js     # Vegetation health computation
│       ├── 02_fire_burn_scar.js        # Fire detection & burn area
│       ├── 03_surface_water_ndwi.js    # Water dynamics & NDWI
│       ├── 04_climate_chirps_lst.js    # Rainfall & temperature
│       ├── 05_land_cover_change.js     # Deforestation monitoring
│       └── 06_baseline_generator.js    # Historical baseline (2018–2023)
├── python/
│   ├── pipeline/
│   │   └── gee_export_processor.py     # GEE CSV ingestion & validation
│   ├── analysis/
│   │   └── report_generator.py         # Automated report assembly
│   └── utils/
│       └── shapefile_manager.py        # Shapefile register & GeoPackage
├── R/
│   └── dashboard/
│       └── app.R                       # R Shiny interactive dashboard
├── data/
│   ├── shapefiles/          # Zone boundary files (.shp)
│   ├── geopackage/          # Assembled GeoPackage (.gpkg)
│   ├── baselines/           # 5-year monthly baselines
│   └── monthly/             # Processed monthly datasets
├── reports/
│   ├── monthly/             # Generated monthly reports
│   └── templates/           # Report templates
├── .github/workflows/
│   └── monthly_pipeline.yml # Automated monthly processing
├── requirements.txt         # Python dependencies
└── README.md
```

---

## Getting Started

### Prerequisites

- **Google Earth Engine** account with access to the collections listed in `config/indicators.json`
- **Python 3.11+** with packages listed in `requirements.txt`
- **R 4.3+** with `shiny`, `shinydashboard`, `leaflet`, `plotly`, `jsonlite`, `DT`

### Installation

```bash
# Clone the repository
git clone https://github.com/ernestmoyo/six_rivers_africa.git
cd six_rivers_africa

# Install Python dependencies
pip install -r requirements.txt

# Install R packages (from R console)
install.packages(c("shiny", "shinydashboard", "leaflet", "plotly", "jsonlite", "DT"))
```

### Running the Pipeline

**1. Generate baselines (first run only):**
Copy `gee/scripts/06_baseline_generator.js` into the GEE Code Editor and run all export tasks.

**2. Monthly data extraction:**
Run scripts `01`–`05` in the GEE Code Editor for the target month. Download CSVs to `gee/exports/`.

**3. Process exports:**
```bash
python python/pipeline/gee_export_processor.py --year 2026 --month 1
```

**4. Generate report:**
```bash
python python/analysis/report_generator.py --year 2026 --month 1 --mode full
```

**5. Launch dashboard:**
```r
shiny::runApp("R/dashboard/app.R")
```

### Report Output Modes

| Mode | Command | Audience |
|------|---------|----------|
| Full monthly report | `--mode full` | Internal / comprehensive |
| Donor brief | `--mode donor` | International funders |
| Alert-only | `--mode alert` | Rapid operational review |

---

## Deliverable Timeline

| Phase | Deliverable | Timeline |
|-------|-------------|----------|
| 1 | Shapefile register — both zones demarcated & validated | Month 1 |
| 1 | GEE data pipeline — historical baseline (2018–2025) | Month 1 |
| 1 | Interactive prototype dashboard (single zone) | Month 2 |
| 2 | Full dashboard — both zones, all indicators, alerting | Month 3 |
| 2 | First automated monthly landscape health report | Month 3 |
| 2 | Staff training — dashboard interpretation & data query | Month 4 |
| 3 | Integration with SRA annual reporting template | Month 5 |
| 3 | Community-facing summary brief (Swahili + English) | Month 6 |

---

## Boundary Update Protocol

When Six Rivers Africa provides verified operational coordinates or shapefiles:

1. Replace placeholder files in `data/shapefiles/`
2. Update `config/zones.json` with verified coordinates and area figures
3. Run: `python python/utils/shapefile_manager.py --checklist`
4. Regenerate baselines in GEE using authoritative polygons
5. Update all report headers from `PLACEHOLDER` to `AUTHORITATIVE`

---

## Data Sources

| Source | Provider | Access |
|--------|----------|--------|
| Sentinel-2 Surface Reflectance | ESA / Copernicus | Google Earth Engine |
| MODIS MOD13Q1 (EVI) | NASA LP DAAC | Google Earth Engine |
| MODIS MOD11A2 (LST) | NASA LP DAAC | Google Earth Engine |
| MODIS MCD64A1 (Burn Area) | NASA LP DAAC | Google Earth Engine |
| NASA FIRMS | NASA LANCE | Google Earth Engine |
| CHIRPS v2.0 | UCSB Climate Hazards Group | Google Earth Engine |
| JRC Global Surface Water | EU JRC | Google Earth Engine |
| ESA WorldCover v200 | ESA | Google Earth Engine |
| Hansen Global Forest Change | University of Maryland | Google Earth Engine |
| WDPA Protected Areas | UNEP-WCMC | Protected Planet |
| Administrative Boundaries | GADM v4.1 | gadm.org |

---

## Key Species & Conservation Context

### Zone 1 — Usangu / Ihefu
Elephant, buffalo, hippopotamus, African wild dog, lion, tigerfish. The Ihefu Swamp is the critical water source for the Great Ruaha River — seasonal desiccation directly threatens downstream ecosystems in Ruaha National Park.

### Zone 2 — Nyerere / Selous
Elephant, lion, African wild dog, Nile crocodile, hippopotamus, sable antelope. One of Africa's largest protected areas and a UNESCO World Heritage Site since 1982. Historically the world's largest elephant population; subject to severe poaching pressure in the 2000s–2010s.

---

## Licence

This project is developed for Six Rivers Africa under the Research & Restoration Programme. All satellite data sources are publicly accessible via Google Earth Engine. Shapefile boundaries are subject to the terms of their respective data providers (WDPA, TANAPA, TAWA).

---

## Contact

**Ernest Moyo**
Epidemiologist & Data Scientist, NM-AIST | Co-founder, 7Square Inc.
Web: [7squareinc.com](https://7squareinc.com)
GitHub: [github.com/ernestmoyo](https://github.com/ernestmoyo)

---

*Prepared by Ernest Moyo / 7Square Inc. — February 2026*
*Aligned with Six Rivers Africa Research & Restoration Pillar*
