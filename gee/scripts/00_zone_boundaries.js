/**
 * Six Rivers Africa — Landscape Health Intelligence Dashboard
 * GEE Script 00: Zone Boundary Definitions
 *
 * PLACEHOLDER boundaries derived from published descriptions.
 * Replace with authoritative shapefiles from Six Rivers Africa / WDPA.
 *
 * CRS: EPSG:4326 (WGS84) | Analysis CRS: EPSG:32736 (UTM 36S)
 * Prepared by: Ernest Moyo / 7Square Inc.
 */

// ============================================================================
// ZONE 1 — Usangu Game Reserve / Ihefu Wetland
// ============================================================================

// Usangu Game Reserve outer boundary (PLACEHOLDER — indicative polygon)
var usanguReserve = ee.Geometry.Polygon([
  [33.25, -8.15], [33.90, -8.10], [34.55, -8.20],
  [34.70, -8.55], [34.65, -8.95], [34.40, -9.15],
  [33.80, -9.10], [33.35, -8.85], [33.20, -8.50],
  [33.25, -8.15]
]);

// Ihefu Swamp Core (PLACEHOLDER — indicative polygon)
// This is the highest-sensitivity sub-zone within Usangu GR
var ihefuCore = ee.Geometry.Polygon([
  [33.70, -8.55], [34.05, -8.50], [34.25, -8.60],
  [34.30, -8.80], [34.10, -8.95], [33.75, -8.90],
  [33.60, -8.75], [33.70, -8.55]
]);

// Great Ruaha River approximate centreline (PLACEHOLDER)
var greatRuahaLine = ee.Geometry.LineString([
  [33.50, -8.40], [33.80, -8.55], [34.10, -8.65],
  [34.40, -8.80], [34.70, -8.90]
]);

// Ikoga Airstrip — Six Rivers Africa operational base (APPROXIMATE)
var ikogaAirstrip = ee.Geometry.Point([34.30, -8.85]);

// ============================================================================
// ZONE 2 — Nyerere National Park (Selous Ecosystem)
// ============================================================================

// Nyerere NP boundary (PLACEHOLDER — indicative polygon)
var nyerereNP = ee.Geometry.Polygon([
  [35.80, -7.40], [37.20, -7.30], [38.50, -7.60],
  [39.20, -8.10], [39.40, -9.00], [39.10, -10.20],
  [38.00, -10.70], [36.50, -10.50], [35.60, -9.80],
  [35.50, -8.60], [35.80, -7.40]
]);

// Rufiji River approximate centreline (PLACEHOLDER)
var rufijiRiver = ee.Geometry.LineString([
  [35.90, -7.80], [36.80, -7.90], [37.50, -7.95],
  [38.20, -8.00], [38.80, -7.80], [39.30, -7.70]
]);

// Stiegler's Gorge approximate location (PLACEHOLDER)
var stieglersGorge = ee.Geometry.Point([37.80, -7.85]);

// ============================================================================
// FEATURE COLLECTIONS — For Zonal Statistics
// ============================================================================

var zone1 = ee.Feature(usanguReserve, {
  'zone_id': 'zone_1',
  'name': 'Usangu Game Reserve',
  'authority': 'TAWA',
  'wdpa_id': '20021',
  'area_km2_indicative': 2500,
  'boundary_status': 'PLACEHOLDER'
});

var zone1_ihefu = ee.Feature(ihefuCore, {
  'zone_id': 'zone_1_ihefu',
  'name': 'Ihefu Swamp Core',
  'authority': 'TAWA',
  'area_km2_indicative': 350,
  'boundary_status': 'PLACEHOLDER',
  'sensitivity': 'HIGHEST — MODERATE alerts escalate to HIGH'
});

var zone2 = ee.Feature(nyerereNP, {
  'zone_id': 'zone_2',
  'name': 'Nyerere National Park (Selous)',
  'authority': 'TANAPA',
  'wdpa_id': '1695',
  'area_km2_indicative': 30893,
  'boundary_status': 'PLACEHOLDER',
  'unesco': 'World Heritage Site (1982)',
  'iucn_category': 'II'
});

var allZones = ee.FeatureCollection([zone1, zone1_ihefu, zone2]);

// ============================================================================
// EXPORT — For use by other scripts
// ============================================================================

exports.usanguReserve = usanguReserve;
exports.ihefuCore = ihefuCore;
exports.nyerereNP = nyerereNP;
exports.greatRuahaLine = greatRuahaLine;
exports.rufijiRiver = rufijiRiver;
exports.ikogaAirstrip = ikogaAirstrip;
exports.stieglersGorge = stieglersGorge;
exports.zone1 = zone1;
exports.zone1_ihefu = zone1_ihefu;
exports.zone2 = zone2;
exports.allZones = allZones;

// ============================================================================
// VISUALISATION (for GEE Code Editor)
// ============================================================================

Map.centerObject(allZones, 6);

Map.addLayer(usanguReserve, {color: '2d8659'}, 'Zone 1: Usangu GR');
Map.addLayer(ihefuCore, {color: '2196F3'}, 'Zone 1: Ihefu Core');
Map.addLayer(nyerereNP, {color: 'C0392B'}, 'Zone 2: Nyerere NP');
Map.addLayer(greatRuahaLine, {color: '1565C0', width: 2}, 'Great Ruaha River');
Map.addLayer(rufijiRiver, {color: '1565C0', width: 2}, 'Rufiji River');
Map.addLayer(ikogaAirstrip, {color: 'FF9800'}, 'Ikoga Airstrip (SRA Base)');
Map.addLayer(stieglersGorge, {color: 'FF5722'}, "Stiegler's Gorge");

print('=== SIX RIVERS AFRICA — ZONE BOUNDARIES ===');
print('Status: PLACEHOLDER — Awaiting verified shapefiles from SRA');
print('Zone 1 (Usangu GR):', usanguReserve.area().divide(1e6), 'km² (indicative)');
print('Zone 1 (Ihefu Core):', ihefuCore.area().divide(1e6), 'km² (indicative)');
print('Zone 2 (Nyerere NP):', nyerereNP.area().divide(1e6), 'km² (indicative)');
