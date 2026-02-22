/**
 * Six Rivers Africa — Landscape Health Intelligence Dashboard
 * GEE Script 02: Fire Detection & Burn Scar Monitoring
 *
 * Sources: NASA FIRMS (near-real-time), MODIS MCD64A1 (monthly burn area)
 * Any active fire within shapefile boundary triggers HIGH alert.
 *
 * Prepared by: Ernest Moyo / 7Square Inc.
 */

var zones = require('users/ernestmoyo/six_rivers_africa:scripts/00_zone_boundaries');

// ============================================================================
// PARAMETERS
// ============================================================================

var YEAR = 2026;
var MONTH = 1;
var startDate = ee.Date.fromYMD(YEAR, MONTH, 1);
var endDate = startDate.advance(1, 'month');

// 30-day window for burn scar assessment
var windowStart = endDate.advance(-30, 'day');

// ============================================================================
// FIRMS — Active Fire Detections (Near-Real-Time)
// ============================================================================

var firms = ee.ImageCollection('FIRMS')
  .filterDate(startDate, endDate);

// Extract fire pixels within each zone
function countFiresInZone(geometry, zoneName) {
  var firePixels = firms.select('T21').max();
  var fireCount = firePixels.gt(0).selfMask().reduceRegion({
    reducer: ee.Reducer.count(),
    geometry: geometry,
    scale: 1000,
    maxPixels: 1e9
  });
  return ee.Feature(null, fireCount)
    .set('zone', zoneName)
    .set('indicator', 'active_fire_count')
    .set('year', YEAR)
    .set('month', MONTH);
}

var z1Fires = countFiresInZone(zones.usanguReserve, 'Usangu GR');
var z1iFires = countFiresInZone(zones.ihefuCore, 'Ihefu Core');
var z2Fires = countFiresInZone(zones.nyerereNP, 'Nyerere NP');

// Fire brightness temperature — hotspot intensity
var fireBrightness = firms.select('T21').max().clip(
  zones.usanguReserve.union(zones.nyerereNP)
);

// ============================================================================
// MCD64A1 — Monthly Burned Area Product
// ============================================================================

var mcd64 = ee.ImageCollection('MODIS/061/MCD64A1')
  .filterDate(startDate, endDate)
  .select('BurnDate');

var burnedArea = mcd64.max().gt(0).selfMask();

function burnAreaKm2(geometry, zoneName) {
  var pixelArea = burnedArea.multiply(ee.Image.pixelArea()).divide(1e6);
  var totalArea = pixelArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 500,
    maxPixels: 1e10
  });
  return ee.Feature(null, totalArea)
    .set('zone', zoneName)
    .set('indicator', 'burn_scar_km2')
    .set('year', YEAR)
    .set('month', MONTH);
}

var z1BurnArea = burnAreaKm2(zones.usanguReserve, 'Usangu GR');
var z1iBurnArea = burnAreaKm2(zones.ihefuCore, 'Ihefu Core');
var z2BurnArea = burnAreaKm2(zones.nyerereNP, 'Nyerere NP');

// ============================================================================
// FIRE TYPE CLASSIFICATION (Heuristic)
// ============================================================================

// Classify fire type based on spatial pattern and context:
// - Prescribed: regular pattern, within known burn management areas
// - Agricultural: concentrated along reserve boundaries, linear patterns
// - Uncontrolled: irregular, large contiguous patches, within core areas

var landCover = ee.Image('ESA/WorldCover/v200').select('Map');
var croplandMask = landCover.eq(40); // ESA WorldCover cropland class
var forestMask = landCover.eq(10).or(landCover.eq(20)); // Tree cover

// Fires near cropland are likely agricultural
var fireNearCropland = fireBrightness.gt(0)
  .and(croplandMask.focal_max(2000, 'circle', 'meters'));

// Fires in forested areas are likely uncontrolled or prescribed
var fireInForest = fireBrightness.gt(0).and(forestMask);

// ============================================================================
// ALERT GENERATION
// ============================================================================

// ANY fire within boundaries = HIGH alert
print('=== FIRE ALERT STATUS ===');
print('Zone 1 (Usangu GR) fire detections:', z1Fires);
print('Zone 1 (Ihefu Core) fire detections:', z1iFires);
print('Zone 2 (Nyerere NP) fire detections:', z2Fires);
print('Zone 1 burn scar area:', z1BurnArea);
print('Zone 2 burn scar area:', z2BurnArea);

// ============================================================================
// EXPORT
// ============================================================================

var allFireStats = ee.FeatureCollection([
  z1Fires, z1iFires, z2Fires,
  z1BurnArea, z1iBurnArea, z2BurnArea
]);

Export.table.toDrive({
  collection: allFireStats,
  description: 'SRA_Fire_' + YEAR + '_' + String(MONTH).padStart(2, '0'),
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'fire_burn_' + YEAR + '_' + String(MONTH).padStart(2, '0'),
  fileFormat: 'CSV'
});

// ============================================================================
// VISUALISATION
// ============================================================================

Map.centerObject(zones.allZones, 6);
Map.addLayer(fireBrightness, {
  min: 300, max: 400, palette: ['yellow', 'orange', 'red']
}, 'Fire Brightness Temperature');
Map.addLayer(burnedArea, {palette: ['8B0000']}, 'Burned Area (MCD64A1)');
Map.addLayer(fireNearCropland.selfMask(), {palette: ['FF9800']}, 'Agricultural Fire (heuristic)');
Map.addLayer(fireInForest.selfMask(), {palette: ['D32F2F']}, 'Forest Fire (heuristic)');
