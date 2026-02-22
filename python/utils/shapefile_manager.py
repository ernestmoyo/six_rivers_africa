"""
Six Rivers Africa — Landscape Health Intelligence Dashboard
Shapefile & GeoPackage Manager

Manages the spatial boundary framework: shapefile registration,
validation, CRS transformation, and GeoPackage assembly.

Author: Ernest Moyo / 7Square Inc.
"""

import json
import logging
from datetime import datetime
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SHAPEFILE_DIR = PROJECT_ROOT / "data" / "shapefiles"
GEOPACKAGE_DIR = PROJECT_ROOT / "data" / "geopackage"
CONFIG_DIR = PROJECT_ROOT / "config"

# ============================================================================
# SHAPEFILE REGISTER
# ============================================================================

SHAPEFILE_REGISTER = {
    "usangu_game_reserve": {
        "filename": "usangu_game_reserve.shp",
        "type": "Polygon",
        "crs": "EPSG:4326",
        "source": "WDPA 20021 / TAWA",
        "status": "PLACEHOLDER",
        "zone_id": "zone_1",
        "wdpa_id": "20021",
        "area_km2_indicative": 2500,
        "date_added": "2026-02-01",
        "date_verified": None,
        "notes": "Outer reserve boundary — replace with authoritative TAWA/WDPA polygon"
    },
    "ihefu_swamp_core": {
        "filename": "ihefu_swamp_core.shp",
        "type": "Polygon",
        "crs": "EPSG:4326",
        "source": "Wetlands International / Ramsar",
        "status": "PLACEHOLDER",
        "zone_id": "zone_1_ihefu",
        "area_km2_indicative": 350,
        "date_added": "2026-02-01",
        "date_verified": None,
        "notes": "Highest sensitivity zone — MODERATE alerts escalate to HIGH"
    },
    "nyerere_np_boundary": {
        "filename": "nyerere_np_boundary.shp",
        "type": "Polygon",
        "crs": "EPSG:4326",
        "source": "Protected Planet (WDPA) IUCN Cat. II",
        "status": "PLACEHOLDER",
        "zone_id": "zone_2",
        "wdpa_id": "1695",
        "area_km2_indicative": 30893,
        "date_added": "2026-02-01",
        "date_verified": None,
        "notes": "UNESCO World Heritage Site (1982) — verify with WDPA 1695 polygon"
    },
    "great_ruaha_river": {
        "filename": "great_ruaha_river.shp",
        "type": "LineString",
        "crs": "EPSG:4326",
        "source": "HydroSHEDS / GRDC",
        "status": "PLACEHOLDER",
        "date_added": "2026-02-01",
        "date_verified": None,
        "notes": "River centreline — confirm with SRA field knowledge"
    },
    "rufiji_river": {
        "filename": "rufiji_river.shp",
        "type": "LineString",
        "crs": "EPSG:4326",
        "source": "HydroSHEDS / GRDC",
        "status": "PLACEHOLDER",
        "date_added": "2026-02-01",
        "date_verified": None,
        "notes": "River centreline — confirm position"
    },
    "six_rivers_study_zones": {
        "filename": "six_rivers_study_zones.shp",
        "type": "Polygon",
        "crs": "EPSG:4326",
        "source": "Composite — both operational zones merged",
        "status": "PENDING",
        "date_added": "2026-02-01",
        "date_verified": None,
        "notes": "Generated from zone_1 + zone_2 union"
    }
}


def get_register() -> dict:
    """Return the current shapefile register."""
    return SHAPEFILE_REGISTER


def get_register_status() -> dict:
    """Summary of boundary verification status."""
    total = len(SHAPEFILE_REGISTER)
    statuses = {}
    for entry in SHAPEFILE_REGISTER.values():
        s = entry["status"]
        statuses[s] = statuses.get(s, 0) + 1

    return {
        "total_shapefiles": total,
        "status_counts": statuses,
        "all_verified": all(e["status"] == "AUTHORITATIVE" for e in SHAPEFILE_REGISTER.values()),
        "pending_sra_input": [
            name for name, e in SHAPEFILE_REGISTER.items()
            if e["status"] in ("PLACEHOLDER", "PENDING")
        ]
    }


def update_shapefile_status(shapefile_name: str, new_status: str,
                            source: str = None, verified_date: str = None,
                            area_km2: float = None):
    """Update shapefile status after receiving verified boundaries."""
    if shapefile_name not in SHAPEFILE_REGISTER:
        raise ValueError(f"Unknown shapefile: {shapefile_name}")

    entry = SHAPEFILE_REGISTER[shapefile_name]
    entry["status"] = new_status

    if source:
        entry["source"] = source
    if verified_date:
        entry["date_verified"] = verified_date
    if area_km2:
        entry["area_km2_verified"] = area_km2

    logger.info(f"Updated {shapefile_name}: status={new_status}")
    return entry


# ============================================================================
# VALIDATION
# ============================================================================

def validate_shapefile_presence() -> dict:
    """Check which shapefiles exist on disk."""
    results = {}
    for name, entry in SHAPEFILE_REGISTER.items():
        filepath = SHAPEFILE_DIR / entry["filename"]
        exists = filepath.exists()
        results[name] = {
            "filename": entry["filename"],
            "exists_on_disk": exists,
            "status": entry["status"],
            "source": entry["source"]
        }
        if not exists:
            logger.warning(f"Missing shapefile: {entry['filename']}")
    return results


def validate_attribute_schema(filepath: Path, required_fields: list) -> dict:
    """Validate shapefile has expected attribute fields."""
    try:
        import geopandas as gpd
        gdf = gpd.read_file(filepath)
        present = set(gdf.columns)
        missing = set(required_fields) - present
        return {
            "filepath": str(filepath),
            "columns": list(gdf.columns),
            "crs": str(gdf.crs),
            "record_count": len(gdf),
            "missing_fields": list(missing),
            "valid": len(missing) == 0
        }
    except ImportError:
        logger.warning("geopandas not available — skipping attribute validation")
        return {"error": "geopandas not installed"}
    except Exception as e:
        return {"error": str(e)}


# ============================================================================
# GEOPACKAGE ASSEMBLY
# ============================================================================

def build_geopackage(output_name: str = "six_rivers_africa.gpkg"):
    """Assemble all available shapefiles into a versioned GeoPackage."""
    try:
        import geopandas as gpd

        output_path = GEOPACKAGE_DIR / output_name
        GEOPACKAGE_DIR.mkdir(parents=True, exist_ok=True)

        layers_written = 0
        for name, entry in SHAPEFILE_REGISTER.items():
            filepath = SHAPEFILE_DIR / entry["filename"]
            if not filepath.exists():
                logger.info(f"Skipping {name} — file not found")
                continue

            gdf = gpd.read_file(filepath)

            # Ensure CRS is WGS84
            if gdf.crs is None:
                gdf = gdf.set_crs("EPSG:4326")
            elif str(gdf.crs) != "EPSG:4326":
                gdf = gdf.to_crs("EPSG:4326")

            # Add metadata columns
            gdf["boundary_status"] = entry["status"]
            gdf["source"] = entry["source"]
            gdf["date_added"] = entry["date_added"]

            gdf.to_file(output_path, layer=name, driver="GPKG")
            layers_written += 1
            logger.info(f"  Added layer: {name} ({len(gdf)} features)")

        logger.info(f"GeoPackage written: {output_path} ({layers_written} layers)")
        return output_path

    except ImportError:
        logger.error("geopandas required for GeoPackage assembly")
        return None


# ============================================================================
# BOUNDARY UPDATE PROTOCOL
# ============================================================================

def boundary_update_checklist() -> str:
    """Generate checklist for when SRA provides verified boundaries."""
    checklist = """
BOUNDARY UPDATE PROTOCOL — Six Rivers Africa
=============================================

When Six Rivers Africa provides verified operational coordinates or shapefiles:

[ ] 1. Replace placeholder shapefile files in data/shapefiles/
[ ] 2. Update SHAPEFILE_REGISTER status from PLACEHOLDER to AUTHORITATIVE
[ ] 3. Update area figures (km²) from authoritative polygon attributes
[ ] 4. Confirm Ikoga airstrip coordinates and any operational site locations
[ ] 5. Rebuild GeoPackage: python -m python.utils.shapefile_manager --build-gpkg
[ ] 6. Update alert thresholds if verified zone areas differ significantly
[ ] 7. Regenerate baseline zonal statistics in GEE using authoritative polygons
[ ] 8. Update Shapefile Status line in report header to AUTHORITATIVE
[ ] 9. Run validation: python -m python.utils.shapefile_manager --validate
[ ] 10. Note the update date and data source in all subsequent reports

Current Status:
"""
    status = get_register_status()
    for name in status["pending_sra_input"]:
        entry = SHAPEFILE_REGISTER[name]
        checklist += f"  - {name}: {entry['status']} (source: {entry['source']})\n"

    return checklist


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Six Rivers Africa Shapefile Manager")
    parser.add_argument("--status", action="store_true", help="Print register status")
    parser.add_argument("--validate", action="store_true", help="Validate shapefile presence")
    parser.add_argument("--build-gpkg", action="store_true", help="Build GeoPackage")
    parser.add_argument("--checklist", action="store_true", help="Print boundary update checklist")
    args = parser.parse_args()

    if args.status:
        status = get_register_status()
        print(json.dumps(status, indent=2))
    elif args.validate:
        results = validate_shapefile_presence()
        print(json.dumps(results, indent=2))
    elif args.build_gpkg:
        build_geopackage()
    elif args.checklist:
        print(boundary_update_checklist())
    else:
        print("Six Rivers Africa — Shapefile Manager")
        print("Use --status, --validate, --build-gpkg, or --checklist")
