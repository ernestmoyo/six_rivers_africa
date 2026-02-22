/**
 * Six Rivers Africa — Landscape Health Intelligence Dashboard
 * GEE Script 03: Surface Water Dynamics & NDWI
 *
 * Monitors Ihefu Swamp inundation extent using JRC Global Surface Water
 * and Sentinel-2 NDWI. Critical for Great Ruaha River connectivity assessment.
 *
 * Prepared by: Ernest Moyo / 7Square Inc.
 */

var zones = require('users/ernestmoyo/six_rivers_africa:scripts/00_zone_boundaries');

// ============================================================================
// PARAMETERS
// ============================================================================

var YEAR = 2026;
var MONTH = 1;
var CLOUD_THRESHOLD = 20;
var BASELINE_START = 2018;
var BASELINE_END = 2023;

var startDate = ee.Date.fromYMD(YEAR, MONTH, 1);
var endDate = startDate.advance(1, 'month');

// ============================================================================
// JRC GLOBAL SURFACE WATER — Monthly Recurrence
// ============================================================================

var jrcMonthly = ee.ImageCollection('JRC/GSW1_4/MonthlyHistory')
  .filterDate(startDate, endDate);

// Water presence: pixel value 2 = water, 1 = not water, 0 = no data
var waterPresent = jrcMonthly.max().eq(2).selfMask();

// Compute water extent in km² for Ihefu Core
function waterExtentKm2(waterImage, geometry, zoneName) {
  var pixelArea = waterImage.multiply(ee.Image.pixelArea()).divide(1e6);
  var total = pixelArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e10
  });
  return ee.Feature(null, total)
    .set('zone', zoneName)
    .set('indicator', 'surface_water_km2')
    .set('year', YEAR)
    .set('month', MONTH);
}

var ihefuWaterCurrent = waterExtentKm2(waterPresent, zones.ihefuCore, 'Ihefu Core');
var usanguWaterCurrent = waterExtentKm2(waterPresent, zones.usanguReserve, 'Usangu GR');

// Baseline: 5-year monthly mean water extent
var baselineWaterImages = ee.List.sequence(BASELINE_START, BASELINE_END).map(function(y) {
  y = ee.Number(y).int();
  var bStart = ee.Date.fromYMD(y, MONTH, 1);
  var bEnd = bStart.advance(1, 'month');
  return ee.ImageCollection('JRC/GSW1_4/MonthlyHistory')
    .filterDate(bStart, bEnd)
    .max()
    .eq(2)
    .selfMask();
});

var baselineWater = ee.ImageCollection.fromImages(baselineWaterImages).mean();
var ihefuWaterBaseline = waterExtentKm2(baselineWater, zones.ihefuCore, 'Ihefu Core Baseline');

// ============================================================================
// SENTINEL-2 NDWI — 10m Resolution
// ============================================================================

function maskS2Clouds(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  return image.updateMask(mask);
}

function computeNDWI(image) {
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return image.addBands(ndwi);
}

var s2Current = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(startDate, endDate)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', CLOUD_THRESHOLD))
  .map(maskS2Clouds)
  .map(computeNDWI);

var ndwiCurrent = s2Current.select('NDWI').median();

// NDWI zonal statistics
function ndwiZonalStats(geometry, zoneName) {
  var stats = ndwiCurrent.reduceRegion({
    reducer: ee.Reducer.mean().combine(ee.Reducer.stdDev(), null, true),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e10
  });
  return ee.Feature(null, stats)
    .set('zone', zoneName)
    .set('indicator', 'NDWI')
    .set('year', YEAR)
    .set('month', MONTH);
}

var z1NDWI = ndwiZonalStats(zones.usanguReserve, 'Usangu GR');
var z1iNDWI = ndwiZonalStats(zones.ihefuCore, 'Ihefu Core');
var z2NDWI = ndwiZonalStats(zones.nyerereNP, 'Nyerere NP');

// ============================================================================
// INUNDATION TREND — Great Ruaha Connectivity
// ============================================================================

// Buffer the Great Ruaha River line by 1km for riparian analysis
var ruahaBuffer = zones.greatRuahaLine.buffer(1000);
var ruahaWater = waterExtentKm2(waterPresent, ruahaBuffer, 'Great Ruaha 1km Buffer');
var ruahaNDWI = ndwiZonalStats(ruahaBuffer, 'Great Ruaha Riparian');

// Rufiji River corridor analysis (Zone 2)
var rufijiBuffer = zones.rufijiRiver.buffer(1000);
var rufijiWater = waterExtentKm2(waterPresent, rufijiBuffer, 'Rufiji River 1km Buffer');
var rufijiNDWI = ndwiZonalStats(rufijiBuffer, 'Rufiji River Riparian');

// ============================================================================
// ALERT: Ihefu Surface Water Deviation >25% from Seasonal Norm
// ============================================================================

// This is computed in post-processing (Python/R) after export,
// as it requires comparing current vs baseline km² values.

// ============================================================================
// EXPORT
// ============================================================================

var allWaterStats = ee.FeatureCollection([
  ihefuWaterCurrent, usanguWaterCurrent, ihefuWaterBaseline,
  z1NDWI, z1iNDWI, z2NDWI,
  ruahaWater, ruahaNDWI, rufijiWater, rufijiNDWI
]);

Export.table.toDrive({
  collection: allWaterStats,
  description: 'SRA_Water_NDWI_' + YEAR + '_' + String(MONTH).padStart(2, '0'),
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'water_ndwi_' + YEAR + '_' + String(MONTH).padStart(2, '0'),
  fileFormat: 'CSV'
});

// ============================================================================
// VISUALISATION
// ============================================================================

var ndwiVis = {min: -0.5, max: 0.5, palette: ['brown', 'white', 'blue']};

Map.centerObject(zones.ihefuCore, 10);
Map.addLayer(waterPresent, {palette: ['1565C0']}, 'JRC Water Presence');
Map.addLayer(ndwiCurrent, ndwiVis, 'NDWI (Sentinel-2)');
Map.addLayer(ruahaBuffer, {color: '0D47A1'}, 'Great Ruaha 1km Buffer');
Map.addLayer(rufijiBuffer, {color: '0D47A1'}, 'Rufiji 1km Buffer');
