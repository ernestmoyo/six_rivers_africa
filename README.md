# Six Rivers Africa — Landscape Health Intelligence Dashboard

**Research & Restoration Programme | Southern Tanzania**

---

## What This Is

A satellite-based landscape monitoring platform for [Six Rivers Africa](https://sixriversafrica.org), tracking environmental health across **~33,393 km²** of protected land in southern Tanzania. The system ingests Google Earth Engine satellite data monthly, detects anomalies against a 5-year baseline, and surfaces alerts for field teams, government authorities (TANAPA/TAWA), and international donors.

**Live Dashboard:** [six-rivers-africa-dashboard.vercel.app](https://six-rivers-africa-dashboard.vercel.app)

---

## Monitoring Zones

| Zone | Area | Authority | Key Feature |
|------|------|-----------|-------------|
| Usangu Game Reserve | ~2,500 km² | TAWA | Ihefu Swamp — critical water source for Great Ruaha River |
| Ihefu Swamp Core | ~350 km² | TAWA | Highest sensitivity; MODERATE alerts auto-escalate to HIGH |
| Nyerere National Park | ~30,893 km² | TANAPA | UNESCO World Heritage Site (1982), Selous ecosystem |

---

## What We Track

Eight satellite-derived indicators, updated monthly:

| Indicator | Source | What It Tells Us |
|-----------|--------|-----------------|
| NDVI / EVI | Sentinel-2, MODIS | Vegetation health and productivity |
| NDWI + Surface Water | Sentinel-2, JRC GSW | Wetland extent, river connectivity |
| Fire & Burn Scar | NASA FIRMS, MODIS MCD64A1 | Active fires, burn area |
| Rainfall Anomaly | CHIRPS v2.0 | Drought/flood context |
| Land Surface Temperature | MODIS MOD11A2 | Thermal stress |
| Land Cover Change | ESA WorldCover, Hansen GFC | Deforestation, encroachment |

Each indicator is compared against a **5-year monthly baseline (2018-2023)** to detect deviations. Alerts trigger at defined thresholds (e.g., NDVI >15% below baseline = MODERATE, >25% = HIGH).

---

## Architecture

```
Google Earth Engine ──> CSV Exports ──> Python Pipeline ──> Web Dashboard
(Sentinel-2, MODIS,     (monthly)     (validation,         (Leaflet maps,
 CHIRPS, FIRMS, JRC)                   anomaly detection,    Plotly charts,
                                       alert engine)         alert tables)
```

| Component | Stack |
|-----------|-------|
| Satellite data extraction | Google Earth Engine (JavaScript) |
| Data processing & alerts | Python (pandas, numpy, geopandas) |
| Web dashboard | Static HTML/JS, Leaflet.js, Plotly.js |
| Hosting | Vercel (static deployment) |
| Boundary data | HDX COD-AB (Tanzania admin), OpenStreetMap (protected areas, rivers) |
| CI/CD | GitHub Actions (monthly pipeline) |

---

## Boundary Sources

| Feature | Source | Status |
|---------|--------|--------|
| Tanzania country + 31 regions | [HDX COD-AB](https://data.humdata.org/dataset/cod-ab-tza) | Official |
| Nyerere National Park | OpenStreetMap (relation/14784881) | Real boundary |
| Selous Game Reserve | OpenStreetMap (relation/14918884) | Real boundary |
| Great Ruaha River | OpenStreetMap (relation/6046577) | Real course |
| Rufiji River | OpenStreetMap (6 ways) | Real course |
| Usangu Game Reserve | Placeholder (estimated) | Awaiting SRA shapefiles |
| Ihefu Swamp Core | Placeholder (estimated) | Awaiting SRA shapefiles |

---

## Quick Start

```bash
git clone https://github.com/ernestmoyo/six_rivers_africa.git
cd six_rivers_africa
pip install -r requirements.txt

# Process monthly GEE exports
python python/pipeline/gee_export_processor.py --year 2026 --month 1

# Generate reports
python python/analysis/report_generator.py --year 2026 --month 1 --mode full

# Run dashboard locally
python -m http.server 8080 --directory web
```

---

## Project Status

- **Dashboard:** Live at [six-rivers-africa-dashboard.vercel.app](https://six-rivers-africa-dashboard.vercel.app)
- **Data pipeline:** Operational (synthetic test data; pending GEE service account)
- **Boundaries:** Nyerere NP and Selous GR use real OSM data; Usangu GR and Ihefu are placeholders
- **Reporting:** Full, donor, and alert-only report modes functional
- **Current period:** January 2026 (DRAFT)

---

## Contact

**Ernest Moyo** — Epidemiologist & Data Scientist, NM-AIST | Co-founder, 7Square Inc.
[7squareinc.com](https://7squareinc.com) | [github.com/ernestmoyo](https://github.com/ernestmoyo)

---

*Prepared by Ernest Moyo / 7Square Inc. — February 2026*
*Six Rivers Africa Research & Restoration Programme*
