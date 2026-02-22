"""
Six Rivers Africa — Landscape Health Intelligence Dashboard
GEE Export Processor

Ingests CSV exports from Google Earth Engine, validates data quality,
computes derived indicators, and generates structured monthly datasets
for the dashboard and reporting pipeline.

Author: Ernest Moyo / 7Square Inc.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = PROJECT_ROOT / "config"
DATA_DIR = PROJECT_ROOT / "data"
EXPORTS_DIR = PROJECT_ROOT / "gee" / "exports"
OUTPUT_DIR = DATA_DIR / "monthly"

with open(CONFIG_DIR / "zones.json") as f:
    ZONES_CONFIG = json.load(f)

with open(CONFIG_DIR / "indicators.json") as f:
    INDICATORS_CONFIG = json.load(f)

ZONE_NAMES = {
    "zone_1": "Usangu GR",
    "zone_1_ihefu": "Ihefu Core",
    "zone_2": "Nyerere NP"
}


# ============================================================================
# DATA INGESTION
# ============================================================================

def load_gee_export(filepath: Path) -> pd.DataFrame:
    """Load and validate a GEE CSV export."""
    logger.info(f"Loading GEE export: {filepath.name}")
    df = pd.read_csv(filepath)

    required_cols = {"zone", "indicator", "year", "month"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df["year"] = df["year"].astype(int)
    df["month"] = df["month"].astype(int)
    logger.info(f"  Loaded {len(df)} records | Zones: {df['zone'].unique()}")
    return df


def load_monthly_exports(year: int, month: int) -> dict:
    """Load all GEE exports for a given month."""
    month_str = f"{year}_{month:02d}"
    datasets = {}

    patterns = {
        "ndvi_evi": f"ndvi_evi_{month_str}.csv",
        "fire": f"fire_burn_{month_str}.csv",
        "water": f"water_ndwi_{month_str}.csv",
        "climate": f"climate_{month_str}.csv",
    }

    for key, filename in patterns.items():
        filepath = EXPORTS_DIR / filename
        if filepath.exists():
            datasets[key] = load_gee_export(filepath)
        else:
            logger.warning(f"  Missing export: {filename}")

    return datasets


# ============================================================================
# DATA QUALITY CHECKS
# ============================================================================

def validate_data_quality(datasets: dict) -> dict:
    """Run quality checks on ingested data and return quality report."""
    quality = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": [],
        "overall_status": "PASS"
    }

    for key, df in datasets.items():
        check = {
            "dataset": key,
            "records": len(df),
            "null_pct": round(df.isnull().mean().mean() * 100, 1),
            "zones_present": df["zone"].unique().tolist(),
            "status": "PASS"
        }

        # Flag high null rates
        if check["null_pct"] > 30:
            check["status"] = "WARNING"
            check["note"] = f"High null rate ({check['null_pct']}%) — likely cloud cover"

        # Verify all expected zones present
        expected_zones = set(ZONE_NAMES.values())
        present_zones = set(check["zones_present"])
        missing_zones = expected_zones - present_zones
        if missing_zones:
            check["status"] = "WARNING"
            check["note"] = f"Missing zones: {missing_zones}"

        quality["checks"].append(check)
        if check["status"] != "PASS":
            quality["overall_status"] = "WARNING"

    return quality


# ============================================================================
# INDICATOR COMPUTATION
# ============================================================================

def compute_deviations(df: pd.DataFrame) -> pd.DataFrame:
    """Compute percentage deviations from baseline for each zone/indicator."""
    current = df[df["indicator"].str.contains("current", case=False)]
    baseline = df[df["indicator"].str.contains("baseline", case=False)]

    results = []
    for zone in df["zone"].unique():
        z_current = current[current["zone"] == zone]
        z_baseline = baseline[baseline["zone"] == zone]

        if z_current.empty or z_baseline.empty:
            continue

        for col in z_current.select_dtypes(include=[np.number]).columns:
            if col in ("year", "month"):
                continue

            c_val = z_current[col].mean()
            b_val = z_baseline[col].mean()

            if b_val != 0 and not np.isnan(b_val):
                dev_pct = ((c_val - b_val) / abs(b_val)) * 100
            else:
                dev_pct = np.nan

            results.append({
                "zone": zone,
                "indicator": col,
                "current": round(c_val, 4),
                "baseline": round(b_val, 4),
                "deviation_pct": round(dev_pct, 1) if not np.isnan(dev_pct) else None
            })

    return pd.DataFrame(results)


# ============================================================================
# ALERT DETECTION
# ============================================================================

def detect_alerts(datasets: dict, deviations: pd.DataFrame) -> list:
    """Apply threshold rules and generate alert list."""
    thresholds = ZONES_CONFIG["alert_thresholds"]
    alerts = []

    # NDVI/EVI deviation alerts
    # Match indicators containing NDVI or EVI in the mean columns (skip stdDev)
    for _, row in deviations.iterrows():
        indicator = row["indicator"]
        is_ndvi = "NDVI" in indicator and "stdDev" not in indicator
        is_evi = "EVI" in indicator and "stdDev" not in indicator

        if (is_ndvi or is_evi) and row["deviation_pct"] is not None:
            dev = row["deviation_pct"]
            zone = row["zone"]

            # Derive a clean indicator label
            indicator_label = "NDVI" if is_ndvi else "EVI"

            if dev <= thresholds["ndvi_evi_high"]["deviation_pct"]:
                severity = "HIGH"
            elif dev <= thresholds["ndvi_evi_moderate"]["deviation_pct"]:
                severity = "MODERATE"
            else:
                continue

            # Ihefu Core escalation rule
            if zone == "Ihefu Core" and severity == "MODERATE":
                severity = "HIGH"
                escalation = "Escalated: MODERATE in Ihefu Core -> HIGH"
            else:
                escalation = None

            alerts.append({
                "zone": zone,
                "indicator": indicator_label,
                "severity": severity,
                "deviation_pct": dev,
                "current": row["current"],
                "baseline": row["baseline"],
                "escalation": escalation
            })

    # Fire alerts (any fire = HIGH)
    if "fire" in datasets:
        fire_df = datasets["fire"]
        for _, row in fire_df.iterrows():
            fire_count_cols = [c for c in row.index if "count" in c.lower() or "T21" in c]
            for col in fire_count_cols:
                if pd.notna(row[col]) and row[col] > 0:
                    alerts.append({
                        "zone": row["zone"],
                        "indicator": "Active Fire",
                        "severity": "HIGH",
                        "detail": f"Fire detections: {int(row[col])}",
                        "escalation": None
                    })

    # Climate alerts
    for _, row in deviations.iterrows():
        if "rainfall" in row["indicator"].lower() and row["deviation_pct"] is not None:
            if row["deviation_pct"] <= -40:
                alerts.append({
                    "zone": row["zone"],
                    "indicator": "Rainfall Deficit",
                    "severity": "HIGH",
                    "deviation_pct": row["deviation_pct"],
                    "detail": "Drought watch — >40% deficit vs 30-yr mean"
                })

        if "LST" in row["indicator"] and row["current"] is not None and row["baseline"] is not None:
            anomaly = row["current"] - row["baseline"]
            if anomaly > 3.0:
                alerts.append({
                    "zone": row["zone"],
                    "indicator": "Land Surface Temperature",
                    "severity": "MODERATE",
                    "detail": f"LST anomaly: +{anomaly:.1f}°C above baseline"
                })

    logger.info(f"  Generated {len(alerts)} alerts")
    return alerts


# ============================================================================
# STRUCTURED OUTPUT
# ============================================================================

def compile_monthly_dataset(year: int, month: int) -> dict:
    """Full monthly processing pipeline: load → validate → compute → alert."""
    logger.info(f"=== Processing: {year}-{month:02d} ===")

    datasets = load_monthly_exports(year, month)
    if not datasets:
        logger.error("No datasets found for this period")
        return None

    quality = validate_data_quality(datasets)

    # Compute deviations where applicable
    deviations = pd.DataFrame()
    if "ndvi_evi" in datasets:
        deviations = pd.concat([
            deviations,
            compute_deviations(datasets["ndvi_evi"])
        ])
    if "climate" in datasets:
        deviations = pd.concat([
            deviations,
            compute_deviations(datasets["climate"])
        ])

    alerts = detect_alerts(datasets, deviations)

    output = {
        "metadata": {
            "report_period": f"{year}-{month:02d}",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "prepared_by": "Ernest Moyo / 7Square Inc.",
            "organisation": "Six Rivers Africa",
            "boundary_status": "PLACEHOLDER",
            "crs_analysis": "EPSG:32736"
        },
        "data_quality": quality,
        "deviations": deviations.to_dict(orient="records") if not deviations.empty else [],
        "alerts": alerts,
        "raw_datasets": {k: v.to_dict(orient="records") for k, v in datasets.items()}
    }

    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"monthly_dataset_{year}_{month:02d}.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)

    logger.info(f"  Output written: {output_path}")
    logger.info(f"  Alerts: {len(alerts)} | Quality: {quality['overall_status']}")

    return output


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Process GEE exports for Six Rivers Africa dashboard"
    )
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True)
    args = parser.parse_args()

    result = compile_monthly_dataset(args.year, args.month)

    if result:
        n_alerts = len(result["alerts"])
        high_alerts = sum(1 for a in result["alerts"] if a.get("severity") == "HIGH")
        print(f"\nProcessing complete: {n_alerts} alerts ({high_alerts} HIGH)")
    else:
        print("\nProcessing failed — check logs")
