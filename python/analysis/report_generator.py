"""
Six Rivers Africa — Landscape Health Intelligence Dashboard
Automated Report Generator

Compiles monthly landscape health reports from processed GEE data
and alert outputs. Supports multiple output modes:
  - Full monthly report (default)
  - Donor brief
  - Government brief
  - Alert-only summary
  - Community brief (Swahili + English)

Author: Ernest Moyo / 7Square Inc.
"""

import json
import logging
from datetime import datetime
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data" / "monthly"
REPORTS_DIR = PROJECT_ROOT / "reports" / "monthly"
TEMPLATE_DIR = PROJECT_ROOT / "reports" / "templates"


# ============================================================================
# REPORT DATA LOADING
# ============================================================================

def load_monthly_data(year: int, month: int) -> dict:
    """Load compiled monthly dataset."""
    path = DATA_DIR / f"monthly_dataset_{year}_{month:02d}.json"
    if not path.exists():
        raise FileNotFoundError(f"Monthly dataset not found: {path}")
    with open(path) as f:
        return json.load(f)


# ============================================================================
# REPORT SECTIONS
# ============================================================================

def format_header(data: dict) -> str:
    """Report header block."""
    meta = data["metadata"]
    period = datetime.strptime(meta["report_period"], "%Y-%m")
    period_str = period.strftime("%B %Y")

    return f"""{'X' * 80}
SIX RIVERS AFRICA -- LANDSCAPE HEALTH INTELLIGENCE REPORT
Research & Restoration Programme
{'X' * 80}
Reporting Period  : {period_str}
Zones Covered     : Usangu GR / Ihefu Wetland  |  Nyerere NP (Selous)
Prepared by       : {meta['prepared_by']}
Data Sources      : Sentinel-2, MODIS, CHIRPS v2.0, NASA FIRMS, JRC GSW, ESA WorldCover
Shapefile Status  : {meta['boundary_status']} -- Awaiting verified boundaries from Six Rivers Africa
Shapefile CRS     : EPSG:4326 (WGS84)  |  Analysis CRS: {meta['crs_analysis']}
Report Generated  : {meta['generated_at'][:10]}
Status            : DRAFT -- Pending field verification
{'X' * 80}
"""


def format_spatial_disclaimer() -> str:
    """Spatial disclaimer for placeholder boundaries."""
    return """
!! SPATIAL DISCLAIMER: Zone boundaries used in this analysis are indicative
placeholders based on published descriptions. Results are directionally
informative but spatial attribution should be treated as approximate until
authoritative shapefiles are received from Six Rivers Africa.
"""


def format_executive_summary(data: dict) -> str:
    """Generate executive summary from alerts and deviations."""
    alerts = data.get("alerts", [])
    high_alerts = [a for a in alerts if a.get("severity") == "HIGH"]

    if high_alerts:
        alert_summary = f"{len(high_alerts)} HIGH-severity alert(s) detected: "
        alert_summary += "; ".join(
            f"{a['indicator']} in {a['zone']}" for a in high_alerts[:3]
        )
        if len(high_alerts) > 3:
            alert_summary += f" (+{len(high_alerts) - 3} additional)"
    else:
        alert_summary = "No HIGH-severity alerts this reporting cycle."

    deviations = data.get("deviations", [])
    ndvi_devs = [d for d in deviations if d.get("indicator") == "NDVI"]

    landscape_status = "stable"
    for d in ndvi_devs:
        dev = d.get("deviation_pct")
        if dev is not None and dev < -15:
            landscape_status = "showing vegetation stress"
            break

    return f"""
EXECUTIVE SUMMARY

{alert_summary} Landscape conditions across the Six Rivers Africa
operational area are {landscape_status}. Detailed per-zone analysis and
recommendations follow below. All findings are subject to field verification
and should be interpreted in the context of placeholder boundary limitations.
"""


def format_zone_section(data: dict, zone_key: str, zone_name: str) -> str:
    """Generate a complete zone section from available data."""
    deviations = data.get("deviations", [])
    alerts = data.get("alerts", [])

    zone_devs = [d for d in deviations if d.get("zone") == zone_name]
    zone_alerts = [a for a in alerts if a.get("zone") == zone_name]

    # Extract indicator values
    def get_indicator(name):
        for d in zone_devs:
            if d.get("indicator") == name:
                return d
        return {"current": "[pending]", "baseline": "[pending]", "deviation_pct": "[pending]"}

    ndvi = get_indicator("NDVI")
    evi = get_indicator("EVI")

    high_count = sum(1 for a in zone_alerts if a.get("severity") == "HIGH")
    mod_count = sum(1 for a in zone_alerts if a.get("severity") == "MODERATE")

    alert_status = "NORMAL"
    if high_count > 0:
        alert_status = "HIGH"
    elif mod_count > 0:
        alert_status = "MODERATE"

    section = f"""
{zone_name.upper()}

  Vegetation Health (NDVI / EVI)
     Current NDVI mean     : {ndvi.get('current', '[pending]')}  |  Baseline: {ndvi.get('baseline', '[pending]')}  |  Deviation: {ndvi.get('deviation_pct', '[pending]')}%
     Current EVI mean      : {evi.get('current', '[pending]')}  |  Baseline: {evi.get('baseline', '[pending]')}  |  Deviation: {evi.get('deviation_pct', '[pending]')}%
     ALERT STATUS          : {alert_status}

  Active Alerts ({len(zone_alerts)} total)
"""
    for alert in zone_alerts:
        section += f"     [{alert.get('severity')}] {alert.get('indicator')}"
        if alert.get("detail"):
            section += f" — {alert['detail']}"
        if alert.get("escalation"):
            section += f" ({alert['escalation']})"
        section += "\n"

    if not zone_alerts:
        section += "     No alerts this cycle.\n"

    return section


def format_alert_table(data: dict) -> str:
    """Combined alert table across all zones."""
    alerts = data.get("alerts", [])
    if not alerts:
        return "\nACTIVE ALERTS THIS MONTH\n  No active alerts.\n"

    header = f"\n{'=' * 80}\nACTIVE ALERTS THIS MONTH\n{'=' * 80}\n"
    header += f"{'Zone':<20} {'Indicator':<25} {'Severity':<10} {'Detail'}\n"
    header += "-" * 80 + "\n"

    for alert in sorted(alerts, key=lambda a: (0 if a.get("severity") == "HIGH" else 1)):
        detail = alert.get("detail", "")
        if alert.get("deviation_pct") is not None:
            detail = f"{alert['deviation_pct']:+.1f}% deviation"
        header += f"{alert.get('zone', ''):<20} {alert.get('indicator', ''):<25} {alert.get('severity', ''):<10} {detail}\n"

    return header


def format_recommendations(data: dict) -> str:
    """Structured recommendations for HIGH alerts."""
    alerts = data.get("alerts", [])
    high_alerts = [a for a in alerts if a.get("severity") == "HIGH"]

    if not high_alerts:
        return "\nRECOMMENDATIONS\n  No HIGH-severity alerts — no immediate actions required.\n"

    section = f"\n{'=' * 80}\nRECOMMENDATIONS\n{'=' * 80}\n"

    for alert in high_alerts:
        zone = alert.get("zone", "Unknown")
        indicator = alert.get("indicator", "Unknown")

        section += f"\n  [{indicator} — {zone}]\n"
        section += f"  (a) SRA Field Teams: Deploy ground-truth verification for {indicator.lower()} signal in {zone}.\n"
        section += f"  (b) Government (TANAPA/TAWA): Formal notification of {indicator.lower()} anomaly in {zone}."

        # UNESCO obligation for Zone 2
        if "Nyerere" in zone:
            section += " Reference Tanzania's UNESCO World Heritage obligations."
        section += "\n"

        section += f"  (c) Donor Reporting: Document {indicator.lower()} evidence for adaptive management reporting.\n"

    return section


# ============================================================================
# FULL REPORT ASSEMBLY
# ============================================================================

def generate_full_report(year: int, month: int) -> str:
    """Assemble the complete monthly landscape health report."""
    data = load_monthly_data(year, month)

    report = format_header(data)

    if data["metadata"].get("boundary_status") == "PLACEHOLDER":
        report += format_spatial_disclaimer()

    report += format_executive_summary(data)
    report += "\n" + "=" * 80 + "\n"
    report += "ZONE 1: USANGU GAME RESERVE / IHEFU WETLAND\n"
    report += "Shapefile: usangu_game_reserve.shp + ihefu_swamp_core.shp\n"
    report += "[Status: PLACEHOLDER boundary | Area: ~2,500 km2 indicative]\n"
    report += format_zone_section(data, "zone_1", "Usangu GR")
    report += format_zone_section(data, "zone_1_ihefu", "Ihefu Core")

    report += "\n" + "=" * 80 + "\n"
    report += "ZONE 2: NYERERE NATIONAL PARK (SELOUS ECOSYSTEM)\n"
    report += "Shapefile: nyerere_np_boundary.shp\n"
    report += "[Status: PLACEHOLDER boundary | Area: ~30,893 km2 indicative | UNESCO World Heritage Site]\n"
    report += format_zone_section(data, "zone_2", "Nyerere NP")

    report += format_alert_table(data)
    report += format_recommendations(data)

    report += f"\n{'=' * 80}\n"
    report += "DATA QUALITY & ASSUMPTIONS NOTES\n"
    report += f"{'=' * 80}\n"

    quality = data.get("data_quality", {})
    report += f"  Overall quality status : {quality.get('overall_status', 'UNKNOWN')}\n"
    report += f"  Boundary confidence    : PLACEHOLDER — pending SRA verified boundaries\n"

    for check in quality.get("checks", []):
        status = check.get("status", "UNKNOWN")
        report += f"  {check.get('dataset', ''):<20} : {status}"
        if check.get("note"):
            report += f" — {check['note']}"
        report += "\n"

    report += f"\n{'X' * 80}\n"
    report += "Report prepared under the Six Rivers Africa Landscape Health Intelligence Initiative.\n"
    report += "All satellite-derived indicators subject to field verification.\n"
    report += "Contact: Ernest Moyo / 7Square Inc.  |  7squareinc.com\n"
    report += f"{'X' * 80}\n"

    return report


# ============================================================================
# OUTPUT MODES
# ============================================================================

def generate_donor_brief(year: int, month: int) -> str:
    """1-page non-technical funder summary."""
    data = load_monthly_data(year, month)
    period = datetime.strptime(data["metadata"]["report_period"], "%Y-%m")

    alerts = data.get("alerts", [])
    high_count = sum(1 for a in alerts if a.get("severity") == "HIGH")

    brief = f"SIX RIVERS AFRICA — LANDSCAPE HEALTH UPDATE\n"
    brief += f"{period.strftime('%B %Y')}\n\n"
    brief += f"Monitoring Coverage: ~33,393 km² across two protected area zones\n"
    brief += f"Indicators Tracked: 8 satellite-derived environmental metrics\n"
    brief += f"Alerts This Month: {len(alerts)} total ({high_count} requiring immediate attention)\n\n"

    brief += "KEY FINDINGS\n"
    brief += format_executive_summary(data)

    brief += "\nIMPACT\n"
    brief += "This monitoring capability directly supports Six Rivers Africa's Research &\n"
    brief += "Restoration pillar by providing continuous, transparent evidence of landscape\n"
    brief += "health to inform adaptive conservation management across southern Tanzania.\n"

    return brief


def generate_alert_only(year: int, month: int) -> str:
    """Alert table and recommendations only."""
    data = load_monthly_data(year, month)
    report = format_header(data)
    report += format_alert_table(data)
    report += format_recommendations(data)
    return report


# ============================================================================
# ENTRY POINT
# ============================================================================

def save_report(content: str, year: int, month: int, mode: str = "full"):
    """Save report to file."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"sra_report_{mode}_{year}_{month:02d}.txt"
    path = REPORTS_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    logger.info(f"Report saved: {path}")
    return path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate Six Rivers Africa reports")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True)
    parser.add_argument("--mode", choices=["full", "donor", "alert", "government"],
                        default="full")
    args = parser.parse_args()

    generators = {
        "full": generate_full_report,
        "donor": generate_donor_brief,
        "alert": generate_alert_only,
    }

    content = generators[args.mode](args.year, args.month)
    path = save_report(content, args.year, args.month, args.mode)
    print(f"Report generated: {path}")
