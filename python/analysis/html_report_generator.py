"""
Six Rivers Africa — Landscape Health Intelligence Dashboard
Interactive HTML Report Generator

Generates a self-contained, shareable HTML report with dynamic Plotly
visualisations — vegetation health, fire, water, climate, alerts,
and trend analysis. Opens in any browser, no server required.

Author: Ernest Moyo / 7Square Inc.
"""

import json
import math
import logging
from datetime import datetime, timezone
from pathlib import Path

import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data" / "monthly"
REPORTS_DIR = PROJECT_ROOT / "reports" / "monthly"

# ============================================================================
# COLOUR PALETTE — Six Rivers Africa Brand
# ============================================================================

COLORS = {
    "primary": "#1B5E20",       # Deep green — conservation
    "primary_light": "#4CAF50",
    "secondary": "#0D47A1",     # Deep blue — water
    "secondary_light": "#2196F3",
    "accent": "#FF6F00",        # Amber — alerts
    "danger": "#D32F2F",        # Red — HIGH alert
    "warning": "#FF9800",       # Orange — MODERATE
    "success": "#4CAF50",       # Green — NORMAL
    "neutral": "#607D8B",       # Grey
    "bg_dark": "#1a1a2e",
    "bg_card": "#16213e",
    "bg_light": "#f5f5f5",
    "text_primary": "#212121",
    "text_secondary": "#757575",
    "zone1": "#2E7D32",         # Usangu GR — green
    "zone1_ihefu": "#1565C0",   # Ihefu Core — blue
    "zone2": "#C62828",         # Nyerere NP — red
}

SEVERITY_COLORS = {
    "HIGH": COLORS["danger"],
    "MODERATE": COLORS["warning"],
    "NORMAL": COLORS["success"],
}


def hex_to_rgba(hex_color: str, alpha: float = 0.5) -> str:
    """Convert hex colour to rgba string for Plotly transparency."""
    hex_color = hex_color.lstrip("#")
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


# ============================================================================
# DATA LOADING
# ============================================================================

def load_data(year: int, month: int) -> dict:
    path = DATA_DIR / f"monthly_dataset_{year}_{month:02d}.json"
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    with open(path) as f:
        return json.load(f)


def safe_val(val, default="N/A"):
    if val is None or val == "[pending]":
        return default
    try:
        if math.isnan(float(val)):
            return default
    except (TypeError, ValueError):
        pass
    return val


# ============================================================================
# CHART GENERATORS
# ============================================================================

def create_ndvi_comparison_chart(data: dict) -> str:
    """Bar chart: NDVI current vs baseline per zone."""
    devs = data.get("deviations", [])
    ndvi_devs = [d for d in devs if "NDVI" in d.get("indicator", "") and "stdDev" not in d.get("indicator", "")]

    zones = []
    current_vals = []
    baseline_vals = []
    zone_colors = []
    color_map = {"Usangu GR": COLORS["zone1"], "Ihefu Core": COLORS["zone1_ihefu"], "Nyerere NP": COLORS["zone2"]}

    for d in ndvi_devs:
        z = d.get("zone", "")
        c = safe_val(d.get("current"), None)
        b = safe_val(d.get("baseline"), None)
        if c is not None and b is not None:
            zones.append(z)
            current_vals.append(float(c))
            baseline_vals.append(float(b))
            zone_colors.append(color_map.get(z, COLORS["neutral"]))

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=zones, y=current_vals, name="Current",
        marker_color=[c for c in zone_colors],
        text=[f"{v:.2f}" for v in current_vals], textposition="outside"
    ))
    fig.add_trace(go.Bar(
        x=zones, y=baseline_vals, name="Baseline (2018-2023)",
        marker_color=[hex_to_rgba(c, 0.5) for c in zone_colors],
        text=[f"{v:.2f}" for v in baseline_vals], textposition="outside"
    ))

    fig.update_layout(
        title="NDVI — Current vs 5-Year Baseline",
        xaxis_title="Zone", yaxis_title="NDVI Mean",
        barmode="group",
        template="plotly_white",
        height=400,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5),
        yaxis=dict(range=[0, max(current_vals + baseline_vals) * 1.2]) if current_vals else {}
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def create_evi_comparison_chart(data: dict) -> str:
    """Bar chart: EVI current vs baseline per zone."""
    devs = data.get("deviations", [])
    evi_devs = [d for d in devs if "EVI" in d.get("indicator", "") and "stdDev" not in d.get("indicator", "")]

    zones = []
    current_vals = []
    baseline_vals = []
    color_map = {"Usangu GR": COLORS["zone1"], "Ihefu Core": COLORS["zone1_ihefu"], "Nyerere NP": COLORS["zone2"]}

    for d in evi_devs:
        c = safe_val(d.get("current"), None)
        b = safe_val(d.get("baseline"), None)
        if c is not None and b is not None:
            zones.append(d["zone"])
            current_vals.append(float(c))
            baseline_vals.append(float(b))

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=zones, y=current_vals, name="Current",
        marker_color=[color_map.get(z, COLORS["neutral"]) for z in zones],
        text=[f"{v:.2f}" for v in current_vals], textposition="outside"
    ))
    fig.add_trace(go.Bar(
        x=zones, y=baseline_vals, name="Baseline (2018-2023)",
        marker_color=[hex_to_rgba(color_map.get(z, COLORS['neutral']), 0.5) for z in zones],
        text=[f"{v:.2f}" for v in baseline_vals], textposition="outside"
    ))

    fig.update_layout(
        title="EVI — Current vs 5-Year Baseline",
        xaxis_title="Zone", yaxis_title="EVI Mean",
        barmode="group", template="plotly_white", height=400,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5),
        yaxis=dict(range=[0, max(current_vals + baseline_vals) * 1.2]) if current_vals else {}
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def create_deviation_gauge_chart(data: dict) -> str:
    """Gauge charts showing deviation from baseline per zone."""
    devs = data.get("deviations", [])
    ndvi_devs = [d for d in devs if "NDVI" in d.get("indicator", "") and "stdDev" not in d.get("indicator", "")]

    n = len(ndvi_devs)
    if n == 0:
        return "<p>No NDVI deviation data available.</p>"

    fig = make_subplots(
        rows=1, cols=n,
        specs=[[{"type": "indicator"}] * n],
        subplot_titles=[d["zone"] for d in ndvi_devs]
    )

    for i, d in enumerate(ndvi_devs):
        dev = safe_val(d.get("deviation_pct"), 0)
        if dev == "N/A":
            dev = 0
        dev = float(dev)

        if dev <= -25:
            color = COLORS["danger"]
        elif dev <= -15:
            color = COLORS["warning"]
        else:
            color = COLORS["success"]

        fig.add_trace(go.Indicator(
            mode="gauge+number+delta",
            value=dev,
            number={"suffix": "%", "font": {"size": 28}},
            delta={"reference": 0, "increasing": {"color": COLORS["success"]}, "decreasing": {"color": COLORS["danger"]}},
            gauge={
                "axis": {"range": [-40, 10], "ticksuffix": "%"},
                "bar": {"color": color},
                "steps": [
                    {"range": [-40, -25], "color": "#FFCDD2"},
                    {"range": [-25, -15], "color": "#FFE0B2"},
                    {"range": [-15, 10], "color": "#C8E6C9"},
                ],
                "threshold": {
                    "line": {"color": "black", "width": 2},
                    "thickness": 0.75,
                    "value": 0,
                },
            },
        ), row=1, col=i+1)

    fig.update_layout(
        title="NDVI Deviation from Baseline by Zone",
        height=300, template="plotly_white",
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def create_climate_chart(data: dict) -> str:
    """Grouped bar chart: Rainfall + LST by zone."""
    devs = data.get("deviations", [])
    rain_devs = [d for d in devs if "rainfall" in d.get("indicator", "").lower()]
    lst_devs = [d for d in devs if "LST" in d.get("indicator", "")]

    fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=["Rainfall (mm) — Current vs 30yr Mean", "Land Surface Temperature (°C)"],
        horizontal_spacing=0.12
    )

    # Rainfall
    for d in rain_devs:
        c = safe_val(d.get("current"), None)
        b = safe_val(d.get("baseline"), None)
        if c is not None and b is not None:
            zone = d["zone"]
            color_map = {"Usangu GR": COLORS["zone1"], "Ihefu Core": COLORS["zone1_ihefu"], "Nyerere NP": COLORS["zone2"]}
            fig.add_trace(go.Bar(
                x=[f"{zone}<br>Current", f"{zone}<br>30yr Mean"],
                y=[float(c), float(b)],
                marker_color=[color_map.get(zone, COLORS["neutral"]), hex_to_rgba(color_map.get(zone, COLORS['neutral']), 0.5)],
                name=zone, showlegend=False
            ), row=1, col=1)

    # LST
    for d in lst_devs:
        c = safe_val(d.get("current"), None)
        b = safe_val(d.get("baseline"), None)
        if c is not None and b is not None:
            zone = d["zone"]
            color_map = {"Usangu GR": COLORS["zone1"], "Ihefu Core": COLORS["zone1_ihefu"], "Nyerere NP": COLORS["zone2"]}
            fig.add_trace(go.Bar(
                x=[f"{zone}<br>Current", f"{zone}<br>Baseline"],
                y=[float(c), float(b)],
                marker_color=[color_map.get(zone, COLORS["neutral"]), hex_to_rgba(color_map.get(zone, COLORS['neutral']), 0.5)],
                name=zone, showlegend=False
            ), row=1, col=2)

    fig.update_layout(
        title="Climate Context",
        height=400, template="plotly_white",
        showlegend=False
    )
    fig.update_yaxes(title_text="Rainfall (mm)", row=1, col=1)
    fig.update_yaxes(title_text="Temperature (°C)", row=1, col=2)
    return fig.to_html(full_html=False, include_plotlyjs=False)


def create_alert_summary_chart(data: dict) -> str:
    """Horizontal bar chart showing alerts by severity."""
    alerts = data.get("alerts", [])
    if not alerts:
        return "<p>No active alerts this reporting cycle.</p>"

    zones = []
    indicators = []
    severities = []
    colors = []

    for a in sorted(alerts, key=lambda x: (0 if x.get("severity") == "HIGH" else 1)):
        zones.append(a.get("zone", ""))
        indicators.append(a.get("indicator", ""))
        severities.append(a.get("severity", ""))
        colors.append(SEVERITY_COLORS.get(a.get("severity"), COLORS["neutral"]))

    labels = [f"{ind} — {zone}" for zone, ind in zip(zones, indicators)]

    fig = go.Figure(go.Bar(
        y=labels,
        x=[1] * len(alerts),
        orientation="h",
        marker_color=colors,
        text=severities,
        textposition="inside",
        textfont=dict(color="white", size=14),
        hovertext=[
            f"Zone: {z}<br>Indicator: {i}<br>Severity: {s}"
            for z, i, s in zip(zones, indicators, severities)
        ],
        hoverinfo="text"
    ))

    fig.update_layout(
        title="Active Alerts — Current Month",
        height=max(200, len(alerts) * 60 + 100),
        template="plotly_white",
        xaxis=dict(visible=False),
        yaxis=dict(autorange="reversed"),
        margin=dict(l=200)
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def create_zone_overview_map() -> str:
    """Interactive Plotly map of operational zones."""
    fig = go.Figure()

    # Zone 1: Usangu GR
    fig.add_trace(go.Scattermap(
        lat=[-8.15, -8.10, -8.20, -8.55, -8.95, -9.15, -9.10, -8.85, -8.50, -8.15],
        lon=[33.25, 33.90, 34.55, 34.70, 34.65, 34.40, 33.80, 33.35, 33.20, 33.25],
        mode="lines",
        fill="toself",
        fillcolor="rgba(46, 125, 50, 0.2)",
        line=dict(color=COLORS["zone1"], width=2),
        name="Zone 1: Usangu GR (~2,500 km²)",
        hoverinfo="name"
    ))

    # Ihefu Core
    fig.add_trace(go.Scattermap(
        lat=[-8.55, -8.50, -8.60, -8.80, -8.95, -8.90, -8.75, -8.55],
        lon=[33.70, 34.05, 34.25, 34.30, 34.10, 33.75, 33.60, 33.70],
        mode="lines",
        fill="toself",
        fillcolor="rgba(21, 101, 192, 0.3)",
        line=dict(color=COLORS["zone1_ihefu"], width=2),
        name="Ihefu Swamp Core (~350 km²)",
        hoverinfo="name"
    ))

    # Zone 2: Nyerere NP
    fig.add_trace(go.Scattermap(
        lat=[-7.40, -7.30, -7.60, -8.10, -9.00, -10.20, -10.70, -10.50, -9.80, -8.60, -7.40],
        lon=[35.80, 37.20, 38.50, 39.20, 39.40, 39.10, 38.00, 36.50, 35.60, 35.50, 35.80],
        mode="lines",
        fill="toself",
        fillcolor="rgba(198, 40, 40, 0.15)",
        line=dict(color=COLORS["zone2"], width=2),
        name="Zone 2: Nyerere NP (~30,893 km²)",
        hoverinfo="name"
    ))

    # Ikoga Airstrip marker
    fig.add_trace(go.Scattermap(
        lat=[-8.85], lon=[34.30],
        mode="markers+text",
        marker=dict(size=12, color=COLORS["accent"]),
        text=["Ikoga Airstrip (SRA Base)"],
        textposition="top right",
        name="SRA Base",
        hoverinfo="text"
    ))

    fig.update_layout(
        title="Six Rivers Africa — Operational Zones (Indicative Boundaries)",
        map=dict(
            style="carto-positron",
            center=dict(lat=-8.8, lon=36.5),
            zoom=5.5
        ),
        height=500,
        margin=dict(l=0, r=0, t=40, b=0),
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01, bgcolor="rgba(255,255,255,0.85)")
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def create_deviation_heatmap(data: dict) -> str:
    """Heatmap showing all indicator deviations across zones."""
    devs = data.get("deviations", [])

    # Filter to meaningful indicators only
    filtered = [d for d in devs if "stdDev" not in d.get("indicator", "")]
    if not filtered:
        return "<p>No deviation data available.</p>"

    zones = sorted(set(d["zone"] for d in filtered))
    indicators = sorted(set(d["indicator"] for d in filtered))

    z_matrix = []
    text_matrix = []
    for ind in indicators:
        row = []
        text_row = []
        for zone in zones:
            match = [d for d in filtered if d["zone"] == zone and d["indicator"] == ind]
            if match:
                val = safe_val(match[0].get("deviation_pct"), None)
                if val is not None and val != "N/A":
                    row.append(float(val))
                    text_row.append(f"{float(val):+.1f}%")
                else:
                    row.append(None)
                    text_row.append("N/A")
            else:
                row.append(None)
                text_row.append("N/A")
        z_matrix.append(row)
        text_matrix.append(text_row)

    # Clean indicator names for display
    display_indicators = [i.replace("_mean", "").replace("_mm", " (mm)").replace("_celsius", " (°C)") for i in indicators]

    fig = go.Figure(data=go.Heatmap(
        z=z_matrix,
        x=zones,
        y=display_indicators,
        text=text_matrix,
        texttemplate="%{text}",
        textfont={"size": 13},
        colorscale=[
            [0.0, COLORS["danger"]],
            [0.4, COLORS["warning"]],
            [0.5, "#FFFDE7"],
            [0.6, "#C8E6C9"],
            [1.0, COLORS["success"]]
        ],
        zmid=0,
        colorbar=dict(title="Deviation %"),
        hoverongaps=False
    ))

    fig.update_layout(
        title="Indicator Deviations — All Zones",
        height=max(300, len(indicators) * 50 + 100),
        template="plotly_white",
        xaxis=dict(side="top")
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


# ============================================================================
# HTML ASSEMBLY
# ============================================================================

def generate_html_report(year: int, month: int) -> Path:
    """Generate complete self-contained HTML report."""
    data = load_data(year, month)
    meta = data["metadata"]
    period = datetime.strptime(meta["report_period"], "%Y-%m")
    period_str = period.strftime("%B %Y")
    alerts = data.get("alerts", [])
    high_count = sum(1 for a in alerts if a.get("severity") == "HIGH")
    mod_count = sum(1 for a in alerts if a.get("severity") == "MODERATE")

    # Generate all charts
    logger.info("Generating charts...")
    map_html = create_zone_overview_map()
    ndvi_chart = create_ndvi_comparison_chart(data)
    evi_chart = create_evi_comparison_chart(data)
    gauge_chart = create_deviation_gauge_chart(data)
    climate_chart = create_climate_chart(data)
    alert_chart = create_alert_summary_chart(data)
    heatmap_chart = create_deviation_heatmap(data)

    # Build alert table rows
    alert_rows = ""
    for a in sorted(alerts, key=lambda x: (0 if x.get("severity") == "HIGH" else 1)):
        sev = a.get("severity", "")
        badge_color = SEVERITY_COLORS.get(sev, COLORS["neutral"])
        dev = a.get("deviation_pct")
        detail = a.get("detail", "")
        if dev is not None:
            detail = f"{dev:+.1f}% deviation"
        alert_rows += f"""
        <tr>
            <td>{a.get('zone', '')}</td>
            <td>{a.get('indicator', '')}</td>
            <td><span class="badge" style="background:{badge_color}">{sev}</span></td>
            <td>{detail}</td>
        </tr>"""

    # Build recommendations HTML
    recs_html = ""
    for a in [a for a in alerts if a.get("severity") == "HIGH"]:
        zone = a.get("zone", "")
        ind = a.get("indicator", "")
        unesco_note = ""
        if "Nyerere" in zone:
            unesco_note = ' Reference Tanzania\'s UNESCO World Heritage obligations.'
        recs_html += f"""
        <div class="rec-card">
            <h4>{ind} — {zone}</h4>
            <p><strong>(a) SRA Field Teams:</strong> Deploy ground-truth verification for {ind.lower()} signal in {zone}.</p>
            <p><strong>(b) Government (TANAPA/TAWA):</strong> Formal notification of {ind.lower()} anomaly in {zone}.{unesco_note}</p>
            <p><strong>(c) Donor Reporting:</strong> Document {ind.lower()} evidence for adaptive management reporting.</p>
        </div>"""

    # Quality checks
    quality = data.get("data_quality", {})
    quality_rows = ""
    for check in quality.get("checks", []):
        status = check.get("status", "")
        status_color = COLORS["success"] if status == "PASS" else COLORS["warning"]
        note = check.get("note", "—")
        quality_rows += f"""
        <tr>
            <td>{check.get('dataset', '')}</td>
            <td>{check.get('records', '')}</td>
            <td>{check.get('null_pct', '')}%</td>
            <td><span class="badge" style="background:{status_color}">{status}</span></td>
            <td>{note}</td>
        </tr>"""

    # Full HTML document
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Six Rivers Africa — Landscape Health Report | {period_str}</title>
    <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: {COLORS['bg_light']};
            color: {COLORS['text_primary']};
            line-height: 1.6;
        }}

        /* Header */
        .report-header {{
            background: linear-gradient(135deg, {COLORS['primary']} 0%, {COLORS['secondary']} 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }}
        .report-header h1 {{ font-size: 28px; margin-bottom: 5px; letter-spacing: 1px; }}
        .report-header h2 {{ font-size: 16px; font-weight: 300; opacity: 0.9; margin-bottom: 20px; }}
        .header-meta {{
            display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;
            font-size: 13px; opacity: 0.85;
        }}
        .header-meta span {{ background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 4px; }}

        /* Disclaimer */
        .disclaimer {{
            background: #FFF3E0; border-left: 4px solid {COLORS['warning']};
            padding: 15px 20px; margin: 20px 30px; border-radius: 4px;
            font-size: 13px;
        }}

        /* KPI Cards */
        .kpi-row {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px; padding: 20px 30px;
        }}
        .kpi-card {{
            background: white; border-radius: 8px; padding: 20px;
            text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border-top: 3px solid {COLORS['primary']};
        }}
        .kpi-card.danger {{ border-top-color: {COLORS['danger']}; }}
        .kpi-card.warning {{ border-top-color: {COLORS['warning']}; }}
        .kpi-value {{ font-size: 32px; font-weight: 700; color: {COLORS['primary']}; }}
        .kpi-card.danger .kpi-value {{ color: {COLORS['danger']}; }}
        .kpi-card.warning .kpi-value {{ color: {COLORS['warning']}; }}
        .kpi-label {{ font-size: 12px; color: {COLORS['text_secondary']}; text-transform: uppercase; letter-spacing: 1px; }}

        /* Sections */
        .section {{
            padding: 25px 30px;
        }}
        .section h2 {{
            font-size: 20px; color: {COLORS['primary']};
            border-bottom: 2px solid {COLORS['primary']};
            padding-bottom: 8px; margin-bottom: 20px;
        }}
        .chart-container {{
            background: white; border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            padding: 15px; margin-bottom: 20px;
        }}
        .chart-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
            gap: 20px;
        }}

        /* Executive Summary */
        .exec-summary {{
            background: white; border-radius: 8px; padding: 25px;
            margin: 0 30px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border-left: 4px solid {COLORS['primary']};
        }}
        .exec-summary h3 {{ color: {COLORS['primary']}; margin-bottom: 10px; }}

        /* Alert Table */
        table {{
            width: 100%; border-collapse: collapse; margin-top: 10px;
        }}
        th {{
            background: {COLORS['primary']}; color: white;
            padding: 10px 15px; text-align: left; font-size: 13px;
        }}
        td {{ padding: 10px 15px; border-bottom: 1px solid #eee; font-size: 14px; }}
        tr:hover {{ background: #f8f8f8; }}
        .badge {{
            display: inline-block; padding: 3px 10px; border-radius: 12px;
            color: white; font-size: 12px; font-weight: 600;
        }}

        /* Recommendations */
        .rec-card {{
            background: #FFF8E1; border-left: 4px solid {COLORS['warning']};
            padding: 15px 20px; margin-bottom: 15px; border-radius: 4px;
        }}
        .rec-card h4 {{ color: {COLORS['danger']}; margin-bottom: 8px; }}

        /* Footer */
        .report-footer {{
            background: {COLORS['primary']};
            color: white; text-align: center;
            padding: 25px; font-size: 13px; margin-top: 30px;
        }}
        .report-footer a {{ color: #81C784; }}

        /* Zone section headers */
        .zone-header {{
            background: white; border-radius: 8px; padding: 15px 20px;
            margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }}
        .zone-header h3 {{ margin-bottom: 5px; }}
        .zone-tag {{
            display: inline-block; padding: 2px 8px; border-radius: 4px;
            font-size: 11px; color: white; margin-right: 5px;
        }}

        @media (max-width: 768px) {{
            .chart-grid {{ grid-template-columns: 1fr; }}
            .kpi-row {{ grid-template-columns: repeat(2, 1fr); }}
            .header-meta {{ flex-direction: column; align-items: center; }}
        }}
    </style>
</head>
<body>

    <!-- HEADER -->
    <div class="report-header">
        <h1>SIX RIVERS AFRICA</h1>
        <h2>Landscape Health Intelligence Report — Research & Restoration Programme</h2>
        <div class="header-meta">
            <span>Period: {period_str}</span>
            <span>Zones: Usangu GR / Ihefu | Nyerere NP (Selous)</span>
            <span>Prepared by: Ernest Moyo / 7Square Inc.</span>
            <span>Generated: {datetime.now(timezone.utc).strftime('%d %b %Y')}</span>
            <span>Status: DRAFT — Pending field verification</span>
        </div>
    </div>

    <!-- SPATIAL DISCLAIMER -->
    <div class="disclaimer">
        <strong>Spatial Disclaimer:</strong> Zone boundaries used in this analysis are indicative
        placeholders based on published descriptions (WDPA, conservation literature). Results are
        directionally informative but spatial attribution should be treated as approximate until
        authoritative shapefiles are received from Six Rivers Africa and loaded into the GEE pipeline.
    </div>

    <!-- KPI CARDS -->
    <div class="kpi-row">
        <div class="kpi-card">
            <div class="kpi-value">~33,393</div>
            <div class="kpi-label">km² Monitored</div>
        </div>
        <div class="kpi-card {'danger' if high_count > 0 else ''}">
            <div class="kpi-value">{high_count}</div>
            <div class="kpi-label">HIGH Alerts</div>
        </div>
        <div class="kpi-card {'warning' if mod_count > 0 else ''}">
            <div class="kpi-value">{mod_count}</div>
            <div class="kpi-label">MODERATE Alerts</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-value">8</div>
            <div class="kpi-label">Indicators Tracked</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-value">3</div>
            <div class="kpi-label">Monitoring Zones</div>
        </div>
    </div>

    <!-- EXECUTIVE SUMMARY -->
    <div class="exec-summary">
        <h3>Executive Summary</h3>
        <p>
            {"<strong style='color:" + COLORS['danger'] + "'>" + str(high_count) + " HIGH-severity alert(s)</strong> detected this reporting cycle: " + "; ".join(a['indicator'] + " in " + a['zone'] for a in alerts if a.get('severity') == 'HIGH') + "." if high_count > 0 else "No HIGH-severity alerts detected this reporting cycle."}
            Landscape conditions across the Six Rivers Africa operational area are being
            monitored using 8 satellite-derived environmental indicators. All findings are subject
            to field verification and should be interpreted in the context of placeholder boundary limitations.
        </p>
    </div>

    <!-- INTERACTIVE MAP -->
    <div class="section">
        <h2>Operational Zones — Southern Tanzania</h2>
        <div class="chart-container">
            {map_html}
        </div>
    </div>

    <!-- VEGETATION HEALTH -->
    <div class="section">
        <h2>Vegetation Health (NDVI & EVI)</h2>
        <div class="chart-grid">
            <div class="chart-container">{ndvi_chart}</div>
            <div class="chart-container">{evi_chart}</div>
        </div>
        <div class="chart-container">{gauge_chart}</div>
    </div>

    <!-- INDICATOR HEATMAP -->
    <div class="section">
        <h2>Multi-Indicator Deviation Analysis</h2>
        <div class="chart-container">{heatmap_chart}</div>
    </div>

    <!-- CLIMATE CONTEXT -->
    <div class="section">
        <h2>Climate Context — Rainfall & Temperature</h2>
        <div class="chart-container">{climate_chart}</div>
    </div>

    <!-- ALERT DASHBOARD -->
    <div class="section">
        <h2>Active Alerts — {period_str}</h2>
        <div class="chart-container">{alert_chart}</div>
        <div class="chart-container">
            <table>
                <thead>
                    <tr><th>Zone</th><th>Indicator</th><th>Severity</th><th>Detail</th></tr>
                </thead>
                <tbody>
                    {alert_rows if alert_rows else '<tr><td colspan="4" style="text-align:center;color:#999;">No active alerts this cycle.</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>

    <!-- RECOMMENDATIONS -->
    <div class="section">
        <h2>Recommendations</h2>
        {recs_html if recs_html else '<p>No HIGH-severity alerts — no immediate actions required.</p>'}
    </div>

    <!-- DATA QUALITY -->
    <div class="section">
        <h2>Data Quality & Assumptions</h2>
        <div class="chart-container">
            <table>
                <thead>
                    <tr><th>Dataset</th><th>Records</th><th>Null %</th><th>Status</th><th>Notes</th></tr>
                </thead>
                <tbody>
                    {quality_rows}
                    <tr>
                        <td><strong>Boundary Confidence</strong></td>
                        <td colspan="4">PLACEHOLDER — pending verified shapefiles from Six Rivers Africa</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- METHODOLOGY -->
    <div class="section">
        <h2>Methodology & Data Sources</h2>
        <div class="chart-container">
            <table>
                <thead>
                    <tr><th>Indicator</th><th>Source</th><th>Resolution</th><th>Baseline</th></tr>
                </thead>
                <tbody>
                    <tr><td>NDVI</td><td>Sentinel-2 SR Harmonized</td><td>10 m</td><td>2018–2023 monthly mean</td></tr>
                    <tr><td>EVI</td><td>MODIS MOD13Q1</td><td>250 m</td><td>2018–2023 monthly mean</td></tr>
                    <tr><td>NDWI</td><td>Sentinel-2 SR Harmonized</td><td>10 m</td><td>2018–2023 monthly mean</td></tr>
                    <tr><td>Surface Water</td><td>JRC Global Surface Water</td><td>30 m</td><td>Seasonal norm</td></tr>
                    <tr><td>Active Fire</td><td>NASA FIRMS</td><td>1 km</td><td>Any detection = HIGH</td></tr>
                    <tr><td>Burn Scar</td><td>MODIS MCD64A1</td><td>500 m</td><td>30-day area threshold</td></tr>
                    <tr><td>Rainfall</td><td>CHIRPS v2.0</td><td>~5.5 km</td><td>1981–2023 (30-yr mean)</td></tr>
                    <tr><td>LST</td><td>MODIS MOD11A2</td><td>1 km</td><td>2018–2023 monthly mean</td></tr>
                    <tr><td>Land Cover</td><td>ESA WorldCover / Hansen GFC</td><td>10–30 m</td><td>Annual change detection</td></tr>
                </tbody>
            </table>
            <p style="margin-top:15px; font-size:13px; color:{COLORS['text_secondary']}">
                CRS: EPSG:4326 (storage) | EPSG:32736 UTM 36S (analysis) |
                All processing via Google Earth Engine.
            </p>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="report-footer">
        <p><strong>Six Rivers Africa — Landscape Health Intelligence Initiative</strong></p>
        <p>Research & Restoration Programme | Southern & Western Tanzania</p>
        <p>All satellite-derived indicators subject to field verification.</p>
        <p>Shapefile boundaries: PLACEHOLDER — awaiting verified files from SRA.</p>
        <p style="margin-top:10px;">
            Prepared by Ernest Moyo / 7Square Inc. |
            <a href="https://7squareinc.com">7squareinc.com</a> |
            <a href="https://github.com/ernestmoyo">github.com/ernestmoyo</a>
        </p>
    </div>

</body>
</html>"""

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = REPORTS_DIR / f"sra_landscape_health_{year}_{month:02d}.html"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    logger.info(f"HTML report generated: {output_path}")
    return output_path


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate Six Rivers Africa HTML report")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True)
    args = parser.parse_args()

    path = generate_html_report(args.year, args.month)
    print(f"\nHTML report generated: {path}")
    print(f"Open in browser to view interactive visualisations.")
