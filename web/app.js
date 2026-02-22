/**
 * Six Rivers Africa — Landscape Health Intelligence Dashboard
 * Frontend Application
 *
 * Loads processed GEE data and renders interactive Leaflet maps,
 * Plotly charts, alert tables, and zone profiles.
 *
 * Author: Ernest Moyo / 7Square Inc.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const COLORS = {
    zone1: '#2E7D32',
    zone1_ihefu: '#1565C0',
    zone2: '#C62828',
    primary: '#1B5E20',
    danger: '#D32F2F',
    warning: '#FF9800',
    success: '#4CAF50',
    neutral: '#607D8B',
    secondary: '#0D47A1',
};

const ZONE_COLORS = {
    'Usangu GR': COLORS.zone1,
    'Ihefu Core': COLORS.zone1_ihefu,
    'Nyerere NP': COLORS.zone2,
};

// Indicative zone boundaries (PLACEHOLDER)
const ZONES = {
    usangu: {
        coords: [[-8.15,33.25],[-8.10,33.90],[-8.20,34.55],[-8.55,34.70],[-8.95,34.65],[-9.15,34.40],[-9.10,33.80],[-8.85,33.35],[-8.50,33.20]],
        color: COLORS.zone1,
        name: 'Zone 1: Usangu Game Reserve',
        area: '~2,500 km²',
        authority: 'TAWA'
    },
    ihefu: {
        coords: [[-8.55,33.70],[-8.50,34.05],[-8.60,34.25],[-8.80,34.30],[-8.95,34.10],[-8.90,33.75],[-8.75,33.60]],
        color: COLORS.zone1_ihefu,
        name: 'Ihefu Swamp Core',
        area: '~350 km²',
        authority: 'TAWA — Highest Sensitivity'
    },
    nyerere: {
        coords: [[-7.40,35.80],[-7.30,37.20],[-7.60,38.50],[-8.10,39.20],[-9.00,39.40],[-10.20,39.10],[-10.70,38.00],[-10.50,36.50],[-9.80,35.60],[-8.60,35.50]],
        color: COLORS.zone2,
        name: 'Zone 2: Nyerere National Park (Selous)',
        area: '~30,893 km²',
        authority: 'TANAPA — UNESCO World Heritage Site'
    }
};

const RIVERS = {
    ruaha: { coords: [[-8.40,33.50],[-8.55,33.80],[-8.65,34.10],[-8.80,34.40],[-8.90,34.70]], name: 'Great Ruaha River' },
    rufiji: { coords: [[-7.80,35.90],[-7.90,36.80],[-7.95,37.50],[-8.00,38.20],[-7.80,38.80],[-7.70,39.30]], name: 'Rufiji River' }
};

let dashboardData = null;
let leafletMap = null;

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadData() {
    try {
        const response = await fetch('data/monthly_2026_01.json');
        dashboardData = await response.json();
        document.getElementById('gen-date').textContent = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
        renderDashboard();
    } catch (err) {
        console.error('Data load error:', err);
        document.getElementById('gen-date').textContent = 'N/A';
        renderDashboard(); // render with empty data
    }
}

// ============================================================================
// NAVIGATION
// ============================================================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');

    const titles = {
        overview: 'Overview', map: 'Interactive Map', vegetation: 'Vegetation Health (NDVI & EVI)',
        water: 'Water & Wetlands', fire: 'Fire Monitoring', climate: 'Climate Context',
        alerts: 'Alert Dashboard', zones: 'Zone Profiles', methodology: 'Methodology & Data Sources'
    };
    document.getElementById('page-title').textContent = titles[pageId] || pageId;

    // Mark active nav
    document.querySelectorAll('.nav-item').forEach(n => {
        if (n.getAttribute('onclick')?.includes(pageId)) n.classList.add('active');
    });

    // Init map if showing map page
    if (pageId === 'map' && !leafletMap) {
        setTimeout(initMap, 100);
    }

    // Close mobile menu
    document.querySelector('.sidebar').classList.remove('open');
}

// ============================================================================
// RENDER DASHBOARD
// ============================================================================

function renderDashboard() {
    renderKPIs();
    renderExecSummary();
    renderOverviewAlerts();
    renderHeatmap();
    renderNDVIChart();
    renderEVIChart();
    renderGauges();
    renderWaterChart();
    renderFireSection();
    renderRainfallChart();
    renderLSTChart();
    renderAlertPage();
    renderZoneDetails();
}

// ============================================================================
// KPI CARDS
// ============================================================================

function renderKPIs() {
    const alerts = dashboardData?.alerts || [];
    const high = alerts.filter(a => a.severity === 'HIGH').length;
    const moderate = alerts.filter(a => a.severity === 'MODERATE').length;

    document.getElementById('kpi-grid').innerHTML = `
        <div class="kpi"><div class="kpi-value">~33,393</div><div class="kpi-label">km&sup2; Monitored</div></div>
        <div class="kpi ${high > 0 ? 'danger' : ''}"><div class="kpi-value">${high}</div><div class="kpi-label">HIGH Alerts</div></div>
        <div class="kpi ${moderate > 0 ? 'warning' : ''}"><div class="kpi-value">${moderate}</div><div class="kpi-label">MODERATE Alerts</div></div>
        <div class="kpi info"><div class="kpi-value">8</div><div class="kpi-label">Indicators</div></div>
        <div class="kpi"><div class="kpi-value">3</div><div class="kpi-label">Zones</div></div>
    `;
}

// ============================================================================
// EXECUTIVE SUMMARY
// ============================================================================

function renderExecSummary() {
    const alerts = dashboardData?.alerts || [];
    const high = alerts.filter(a => a.severity === 'HIGH');
    const devs = dashboardData?.deviations || [];
    const ndviDevs = devs.filter(d => d.indicator?.includes('NDVI') && !d.indicator?.includes('stdDev'));
    const stressed = ndviDevs.some(d => d.deviation_pct != null && d.deviation_pct < -15);

    let html = '';
    if (high.length > 0) {
        html += `<p style="margin-bottom:12px"><strong style="color:var(--danger)">${high.length} HIGH-severity alert(s)</strong> detected: ${high.map(a => `${a.indicator} in ${a.zone}`).join('; ')}.</p>`;
    } else {
        html += '<p style="margin-bottom:12px">No HIGH-severity alerts this reporting cycle.</p>';
    }
    html += `<p>Landscape conditions are <strong>${stressed ? 'showing vegetation stress' : 'stable'}</strong>. `;
    html += 'Monitoring covers ~33,393 km&sup2; across Usangu Game Reserve, Ihefu Wetland, and Nyerere National Park using 8 satellite-derived indicators.</p>';
    html += '<p style="margin-top:12px;color:var(--text-secondary);font-size:12px;">All findings subject to field verification. Boundaries are placeholder — awaiting verified shapefiles from Six Rivers Africa.</p>';

    document.getElementById('exec-summary').innerHTML = html;
}

// ============================================================================
// OVERVIEW ALERT MINI TABLE
// ============================================================================

function renderOverviewAlerts() {
    const alerts = dashboardData?.alerts || [];
    if (alerts.length === 0) {
        document.getElementById('overview-alerts').innerHTML = '<p style="color:var(--text-secondary);padding:20px;text-align:center;">No active alerts.</p>';
        return;
    }
    let html = '<table class="data-table"><thead><tr><th>Zone</th><th>Indicator</th><th>Severity</th></tr></thead><tbody>';
    alerts.sort((a,b) => a.severity === 'HIGH' ? -1 : 1).forEach(a => {
        const cls = a.severity === 'HIGH' ? 'badge-high' : 'badge-moderate';
        html += `<tr><td>${a.zone}</td><td>${a.indicator}</td><td><span class="badge ${cls}">${a.severity}</span></td></tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('overview-alerts').innerHTML = html;
}

// ============================================================================
// HELPER: Get deviations
// ============================================================================

function getDevs(indicatorMatch) {
    return (dashboardData?.deviations || []).filter(d =>
        d.indicator?.includes(indicatorMatch) && !d.indicator?.includes('stdDev')
    );
}

function safeVal(v) { return (v == null || (typeof v === 'number' && isNaN(v))) ? null : v; }

// ============================================================================
// NDVI CHART
// ============================================================================

function renderNDVIChart() {
    const devs = getDevs('NDVI');
    const zones = devs.map(d => d.zone);
    const current = devs.map(d => safeVal(d.current));
    const baseline = devs.map(d => safeVal(d.baseline));

    Plotly.newPlot('ndvi-chart', [
        { x: zones, y: current, name: 'Current', type: 'bar', marker: { color: zones.map(z => ZONE_COLORS[z] || COLORS.neutral) }, text: current.map(v => v?.toFixed(2) || 'N/A'), textposition: 'outside' },
        { x: zones, y: baseline, name: 'Baseline (2018-2023)', type: 'bar', marker: { color: zones.map(z => (ZONE_COLORS[z] || COLORS.neutral) + '88'), opacity: 0.6 }, text: baseline.map(v => v?.toFixed(2) || 'N/A'), textposition: 'outside' }
    ], {
        barmode: 'group', template: 'plotly_white', height: 350, margin: { t: 30, b: 40 },
        yaxis: { title: 'NDVI Mean', range: [0, Math.max(...current.filter(Boolean), ...baseline.filter(Boolean)) * 1.25 || 1] },
        legend: { orientation: 'h', y: 1.12 }
    }, { responsive: true });
}

// ============================================================================
// EVI CHART
// ============================================================================

function renderEVIChart() {
    const devs = getDevs('EVI');
    const zones = devs.map(d => d.zone);
    const current = devs.map(d => safeVal(d.current));
    const baseline = devs.map(d => safeVal(d.baseline));

    Plotly.newPlot('evi-chart', [
        { x: zones, y: current, name: 'Current', type: 'bar', marker: { color: zones.map(z => ZONE_COLORS[z] || COLORS.neutral) }, text: current.map(v => v?.toFixed(2) || 'N/A'), textposition: 'outside' },
        { x: zones, y: baseline, name: 'Baseline (2018-2023)', type: 'bar', marker: { color: zones.map(z => (ZONE_COLORS[z] || COLORS.neutral) + '88'), opacity: 0.6 }, text: baseline.map(v => v?.toFixed(2) || 'N/A'), textposition: 'outside' }
    ], {
        barmode: 'group', template: 'plotly_white', height: 350, margin: { t: 30, b: 40 },
        yaxis: { title: 'EVI Mean', range: [0, Math.max(...current.filter(Boolean), ...baseline.filter(Boolean)) * 1.25 || 1] },
        legend: { orientation: 'h', y: 1.12 }
    }, { responsive: true });
}

// ============================================================================
// GAUGE CHARTS
// ============================================================================

function renderGauges() {
    const devs = getDevs('NDVI');
    if (devs.length === 0) return;

    const traces = devs.map((d, i) => {
        const dev = safeVal(d.deviation_pct) || 0;
        const color = dev <= -25 ? COLORS.danger : dev <= -15 ? COLORS.warning : COLORS.success;
        return {
            type: 'indicator', mode: 'gauge+number',
            value: dev,
            number: { suffix: '%', font: { size: 24 } },
            gauge: {
                axis: { range: [-40, 10], ticksuffix: '%' },
                bar: { color },
                steps: [
                    { range: [-40, -25], color: '#FFCDD2' },
                    { range: [-25, -15], color: '#FFE0B2' },
                    { range: [-15, 10], color: '#C8E6C9' },
                ],
                threshold: { line: { color: 'black', width: 2 }, thickness: 0.75, value: 0 }
            },
            title: { text: d.zone, font: { size: 13 } },
            domain: { row: 0, column: i }
        };
    });

    Plotly.newPlot('gauge-chart', traces, {
        grid: { rows: 1, columns: devs.length, pattern: 'independent' },
        template: 'plotly_white', height: 260, margin: { t: 40, b: 20 }
    }, { responsive: true });
}

// ============================================================================
// HEATMAP
// ============================================================================

function renderHeatmap() {
    const devs = (dashboardData?.deviations || []).filter(d => !d.indicator?.includes('stdDev'));
    if (devs.length === 0) return;

    const zones = [...new Set(devs.map(d => d.zone))];
    const indicators = [...new Set(devs.map(d => d.indicator))];
    const displayInds = indicators.map(i => i.replace('_mean','').replace('_mm',' (mm)').replace('_celsius',' (°C)'));

    const z = indicators.map(ind =>
        zones.map(zone => {
            const match = devs.find(d => d.zone === zone && d.indicator === ind);
            return match ? safeVal(match.deviation_pct) : null;
        })
    );
    const text = z.map(row => row.map(v => v != null ? (v >= 0 ? '+' : '') + v.toFixed(1) + '%' : 'N/A'));

    Plotly.newPlot('heatmap-chart', [{
        z, x: zones, y: displayInds, text, texttemplate: '%{text}',
        type: 'heatmap',
        colorscale: [[0,'#D32F2F'],[0.35,'#FF9800'],[0.5,'#FFFDE7'],[0.65,'#C8E6C9'],[1,'#4CAF50']],
        zmid: 0, colorbar: { title: 'Deviation %' }, hoverongaps: false
    }], {
        template: 'plotly_white', height: Math.max(300, indicators.length * 45 + 80),
        margin: { l: 120, t: 20, r: 20 },
        xaxis: { side: 'top' }
    }, { responsive: true });
}

// ============================================================================
// WATER CHART
// ============================================================================

function renderWaterChart() {
    const raw = dashboardData?.raw_datasets?.water || [];
    const ndwi = raw.filter(r => r.indicator === 'NDWI');
    const water = raw.filter(r => r.indicator === 'surface_water_km2');

    const zones = [...new Set([...ndwi.map(r=>r.zone), ...water.map(r=>r.zone)])];

    const traces = [];
    if (ndwi.length > 0) {
        traces.push({
            x: ndwi.map(r => r.zone), y: ndwi.map(r => r.NDWI_mean),
            type: 'bar', name: 'NDWI Mean',
            marker: { color: ndwi.map(r => ZONE_COLORS[r.zone] || COLORS.secondary) }
        });
    }

    Plotly.newPlot('water-chart', traces.length > 0 ? traces : [{
        x: ['No data'], y: [0], type: 'bar', marker: { color: '#ddd' }
    }], {
        template: 'plotly_white', height: 350, margin: { t: 30 },
        yaxis: { title: 'NDWI Mean' },
        legend: { orientation: 'h', y: 1.1 }
    }, { responsive: true });
}

// ============================================================================
// FIRE SECTION
// ============================================================================

function renderFireSection() {
    const raw = dashboardData?.raw_datasets?.fire || [];
    const fires = raw.filter(r => r.indicator === 'active_fire_count');
    const burns = raw.filter(r => r.indicator === 'burn_scar_km2');

    // KPIs
    const z1Fire = fires.find(r => r.zone === 'Usangu GR')?.T21_count || 0;
    const z2Fire = fires.find(r => r.zone === 'Nyerere NP')?.T21_count || 0;
    const totalBurn = burns.reduce((sum, r) => sum + (r.BurnDate_sum || 0), 0);

    document.getElementById('fire-kpi-grid').innerHTML = `
        <div class="kpi ${z1Fire > 0 ? 'danger' : ''}"><div class="kpi-value">${z1Fire}</div><div class="kpi-label">Zone 1 Fire Detections</div></div>
        <div class="kpi ${z2Fire > 0 ? 'danger' : ''}"><div class="kpi-value">${z2Fire}</div><div class="kpi-label">Zone 2 Fire Detections</div></div>
        <div class="kpi ${totalBurn > 0 ? 'warning' : ''}"><div class="kpi-value">${totalBurn.toFixed(1)}</div><div class="kpi-label">km&sup2; Burn Scar (30-day)</div></div>
    `;

    // Chart
    const allZones = [...new Set([...fires.map(r=>r.zone), ...burns.map(r=>r.zone)])];
    Plotly.newPlot('fire-chart', [
        {
            x: fires.map(r => r.zone), y: fires.map(r => r.T21_count || 0),
            type: 'bar', name: 'Fire Detections',
            marker: { color: COLORS.danger }
        },
        {
            x: burns.map(r => r.zone), y: burns.map(r => r.BurnDate_sum || 0),
            type: 'bar', name: 'Burn Scar (km²)',
            marker: { color: COLORS.warning }, yaxis: 'y2'
        }
    ], {
        template: 'plotly_white', height: 350, margin: { t: 30 },
        barmode: 'group',
        yaxis: { title: 'Fire Detections' },
        yaxis2: { title: 'Burn Scar (km²)', overlaying: 'y', side: 'right' },
        legend: { orientation: 'h', y: 1.12 }
    }, { responsive: true });
}

// ============================================================================
// RAINFALL CHART
// ============================================================================

function renderRainfallChart() {
    const devs = (dashboardData?.deviations || []).filter(d => d.indicator?.includes('rainfall'));
    const zones = devs.map(d => d.zone);
    const current = devs.map(d => safeVal(d.current));
    const baseline = devs.map(d => safeVal(d.baseline));

    Plotly.newPlot('rainfall-chart', [
        { x: zones, y: current, name: 'Current (mm)', type: 'bar', marker: { color: zones.map(z => ZONE_COLORS[z] || COLORS.secondary) } },
        { x: zones, y: baseline, name: '30yr Mean (mm)', type: 'bar', marker: { color: zones.map(z => (ZONE_COLORS[z] || COLORS.secondary) + '88'), opacity: 0.6 } }
    ], {
        barmode: 'group', template: 'plotly_white', height: 350, margin: { t: 30 },
        yaxis: { title: 'Rainfall (mm)' },
        legend: { orientation: 'h', y: 1.12 }
    }, { responsive: true });
}

// ============================================================================
// LST CHART
// ============================================================================

function renderLSTChart() {
    const devs = (dashboardData?.deviations || []).filter(d => d.indicator?.includes('LST'));
    const zones = devs.map(d => d.zone);
    const current = devs.map(d => safeVal(d.current));
    const baseline = devs.map(d => safeVal(d.baseline));

    Plotly.newPlot('lst-chart', [
        { x: zones, y: current, name: 'Current (°C)', type: 'bar', marker: { color: zones.map(z => ZONE_COLORS[z] || COLORS.danger) } },
        { x: zones, y: baseline, name: 'Baseline (°C)', type: 'bar', marker: { color: zones.map(z => (ZONE_COLORS[z] || COLORS.danger) + '88'), opacity: 0.6 } }
    ], {
        barmode: 'group', template: 'plotly_white', height: 350, margin: { t: 30 },
        yaxis: { title: 'Temperature (°C)' },
        legend: { orientation: 'h', y: 1.12 }
    }, { responsive: true });
}

// ============================================================================
// ALERT PAGE
// ============================================================================

function renderAlertPage() {
    const alerts = dashboardData?.alerts || [];

    // Bar chart
    if (alerts.length > 0) {
        const labels = alerts.map(a => `${a.indicator} — ${a.zone}`);
        const colors = alerts.map(a => a.severity === 'HIGH' ? COLORS.danger : COLORS.warning);

        Plotly.newPlot('alert-bar-chart', [{
            y: labels, x: labels.map(() => 1),
            orientation: 'h', type: 'bar',
            marker: { color: colors },
            text: alerts.map(a => a.severity),
            textposition: 'inside', textfont: { color: 'white', size: 13 },
            hovertext: alerts.map(a => `${a.zone}: ${a.indicator} (${a.severity})`),
            hoverinfo: 'text'
        }], {
            template: 'plotly_white', height: Math.max(180, alerts.length * 55 + 60),
            xaxis: { visible: false }, yaxis: { autorange: 'reversed' },
            margin: { l: 200, t: 10, r: 20 }
        }, { responsive: true });
    }

    // Table
    const tbody = document.querySelector('#alert-table tbody');
    tbody.innerHTML = '';
    if (alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:30px;">No active alerts this reporting cycle.</td></tr>';
    } else {
        alerts.sort((a,b) => a.severity === 'HIGH' ? -1 : 1).forEach(a => {
            const cls = a.severity === 'HIGH' ? 'badge-high' : 'badge-moderate';
            let detail = a.detail || '';
            if (a.deviation_pct != null) detail = `${a.deviation_pct > 0 ? '+' : ''}${a.deviation_pct.toFixed(1)}% deviation`;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${a.zone}</td><td>${a.indicator}</td><td><span class="badge ${cls}">${a.severity}</span></td><td>${detail}</td>`;
            tbody.appendChild(tr);
        });
    }

    // Recommendations
    const highAlerts = alerts.filter(a => a.severity === 'HIGH');
    const recSection = document.getElementById('recommendations-section');
    if (highAlerts.length === 0) {
        recSection.innerHTML = '<div class="card"><div class="card-title">Recommendations</div><p style="color:var(--text-secondary);">No HIGH-severity alerts — no immediate actions required.</p></div>';
    } else {
        let html = '<div class="card"><div class="card-title"><span class="dot" style="background:var(--danger)"></span> Recommendations (HIGH Alerts)</div>';
        highAlerts.forEach(a => {
            const unesco = a.zone.includes('Nyerere') ? ' Reference Tanzania\'s UNESCO World Heritage obligations.' : '';
            html += `<div class="rec-card">
                <h4>${a.indicator} — ${a.zone}</h4>
                <p><strong>(a) SRA Field Teams:</strong> Deploy ground-truth verification for ${a.indicator.toLowerCase()} signal in ${a.zone}.</p>
                <p><strong>(b) Government (TANAPA/TAWA):</strong> Formal notification of ${a.indicator.toLowerCase()} anomaly in ${a.zone}.${unesco}</p>
                <p><strong>(c) Donor Reporting:</strong> Document ${a.indicator.toLowerCase()} evidence for adaptive management reporting.</p>
            </div>`;
        });
        html += '</div>';
        recSection.innerHTML = html;
    }
}

// ============================================================================
// ZONE DETAILS
// ============================================================================

function renderZoneDetails() {
    const devs = dashboardData?.deviations || [];
    const alerts = dashboardData?.alerts || [];

    const zoneData = [
        { key: 'Usangu GR', cls: '', label: 'Zone 1', tag: 'z1', fullName: 'Usangu Game Reserve / Ihefu Wetland', authority: 'TAWA', area: '~2,500 km²' },
        { key: 'Ihefu Core', cls: 'ihefu', label: 'Core', tag: 'z1i', fullName: 'Ihefu Swamp Core', authority: 'TAWA', area: '~350 km²' },
        { key: 'Nyerere NP', cls: 'z2', label: 'Zone 2', tag: 'z2', fullName: 'Nyerere National Park (Selous)', authority: 'TANAPA', area: '~30,893 km²' },
    ];

    let html = '';
    zoneData.forEach(z => {
        const zDevs = devs.filter(d => d.zone === z.key && !d.indicator?.includes('stdDev'));
        const zAlerts = alerts.filter(a => a.zone === z.key);
        const highCount = zAlerts.filter(a => a.severity === 'HIGH').length;

        html += `<div class="card" style="border-left: 4px solid var(--${z.tag === 'z1' ? 'zone1' : z.tag === 'z1i' ? 'zone1-ihefu' : 'zone2'});">
            <div class="card-title"><span class="zone-tag ${z.tag}">${z.label}</span> ${z.fullName}</div>
            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">${z.authority} | ${z.area} | ${zAlerts.length} alert(s)</p>
            <table class="data-table">
                <thead><tr><th>Indicator</th><th>Current</th><th>Baseline</th><th>Deviation</th></tr></thead>
                <tbody>`;

        zDevs.forEach(d => {
            const c = safeVal(d.current);
            const b = safeVal(d.baseline);
            const dev = safeVal(d.deviation_pct);
            const devStr = dev != null ? `${dev > 0 ? '+' : ''}${dev.toFixed(1)}%` : 'N/A';
            const devColor = dev != null ? (dev <= -25 ? 'var(--danger)' : dev <= -15 ? 'var(--warning)' : 'var(--success)') : 'inherit';
            const indName = d.indicator.replace('_mean','').replace('_mm',' (mm)').replace('_celsius',' (°C)');
            html += `<tr><td>${indName}</td><td>${c != null ? (typeof c === 'number' ? c.toFixed(2) : c) : 'N/A'}</td><td>${b != null ? (typeof b === 'number' ? b.toFixed(2) : b) : 'N/A'}</td><td style="color:${devColor};font-weight:600;">${devStr}</td></tr>`;
        });

        html += `</tbody></table></div>`;
    });

    document.getElementById('zone-detail-cards').innerHTML = html;
}

// ============================================================================
// LEAFLET MAP
// ============================================================================

function initMap() {
    if (leafletMap) return;

    leafletMap = L.map('overview-map', { zoomControl: true }).setView([-8.8, 36.5], 6);

    // Tile layers
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri World Imagery'
    });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    });
    const topo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri Topo'
    });

    satellite.addTo(leafletMap);

    // Zone polygons
    const usanguPoly = L.polygon(ZONES.usangu.coords, {
        color: ZONES.usangu.color, weight: 2, fillOpacity: 0.15
    }).bindPopup(`<strong>${ZONES.usangu.name}</strong><br>Authority: ${ZONES.usangu.authority}<br>Area: ${ZONES.usangu.area}<br><em>PLACEHOLDER boundary</em>`);

    const ihefuPoly = L.polygon(ZONES.ihefu.coords, {
        color: ZONES.ihefu.color, weight: 2, fillOpacity: 0.25
    }).bindPopup(`<strong>${ZONES.ihefu.name}</strong><br>Authority: ${ZONES.ihefu.authority}<br>Area: ${ZONES.ihefu.area}<br><em>MODERATE alerts → HIGH</em>`);

    const nyererePoly = L.polygon(ZONES.nyerere.coords, {
        color: ZONES.nyerere.color, weight: 2, fillOpacity: 0.10
    }).bindPopup(`<strong>${ZONES.nyerere.name}</strong><br>Authority: ${ZONES.nyerere.authority}<br>Area: ${ZONES.nyerere.area}<br>UNESCO World Heritage Site (1982)<br><em>PLACEHOLDER boundary</em>`);

    // Rivers
    const ruahaLine = L.polyline(RIVERS.ruaha.coords, { color: '#1565C0', weight: 3, dashArray: '8, 4' })
        .bindPopup(`<strong>${RIVERS.ruaha.name}</strong><br><em>Approximate centreline</em>`);
    const rufijiLine = L.polyline(RIVERS.rufiji.coords, { color: '#1565C0', weight: 3, dashArray: '8, 4' })
        .bindPopup(`<strong>${RIVERS.rufiji.name}</strong><br><em>Approximate centreline</em>`);

    // Markers
    const ikoga = L.marker([-8.85, 34.30]).bindPopup('<strong>Ikoga Airstrip</strong><br>Six Rivers Africa Operational Base<br><em>Location approximate</em>');

    // Layer groups
    const zonesGroup = L.layerGroup([usanguPoly, ihefuPoly, nyererePoly]).addTo(leafletMap);
    const riversGroup = L.layerGroup([ruahaLine, rufijiLine]).addTo(leafletMap);
    const markersGroup = L.layerGroup([ikoga]).addTo(leafletMap);

    // Controls
    L.control.layers(
        { 'Satellite': satellite, 'Street Map': osm, 'Topographic': topo },
        { 'Zone Boundaries': zonesGroup, 'Rivers': riversGroup, 'Markers': markersGroup },
        { collapsed: false }
    ).addTo(leafletMap);

    L.control.scale({ position: 'bottomleft' }).addTo(leafletMap);

    // Legend
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.cssText = 'background:white;padding:10px 14px;border-radius:8px;font-size:11px;line-height:1.8;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
        div.innerHTML = `
            <strong>Six Rivers Africa</strong><br>
            <span style="display:inline-block;width:12px;height:12px;background:${COLORS.zone1};border-radius:2px;"></span> Usangu GR<br>
            <span style="display:inline-block;width:12px;height:12px;background:${COLORS.zone1_ihefu};border-radius:2px;"></span> Ihefu Core<br>
            <span style="display:inline-block;width:12px;height:12px;background:${COLORS.zone2};border-radius:2px;"></span> Nyerere NP<br>
            <span style="display:inline-block;width:12px;height:3px;background:#1565C0;margin:4px 0;"></span> Rivers<br>
            <span style="color:${COLORS.warning};font-weight:600;">PLACEHOLDER</span>
        `;
        return div;
    };
    legend.addTo(leafletMap);
}

// ============================================================================
// INIT
// ============================================================================

document.addEventListener('DOMContentLoaded', loadData);
