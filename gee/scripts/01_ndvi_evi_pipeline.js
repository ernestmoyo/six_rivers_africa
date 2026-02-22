/**
 * Six Rivers Africa — Landscape Health Intelligence Dashboard
 * GEE Script 01: NDVI & EVI Monthly Computation Pipeline
 *
 * Computes monthly NDVI (Sentinel-2) and EVI (MODIS) zonal statistics
 * for both operational zones, including 5-year baseline comparison.
 *
 * Prepared by: Ernest Moyo / 7Square Inc.
 */

var zones = require('users/ernestmoyo/six_rivers_africa:scripts/00_zone_boundaries');

// ============================================================================
// PARAMETERS
// ============================================================================

var YEAR = 2026;
var MONTH = 1; // January
var CLOUD_THRESHOLD = 20; // Maximum cloud cover percentage
var BASELINE_START = 2018;
var BASELINE_END = 2023;

var startDate = ee.Date.fromYMD(YEAR, MONTH, 1);
var endDate = startDate.advance(1, 'month');

// ============================================================================
// SENTINEL-2 NDVI — 10m Resolution
// ============================================================================

function maskS2Clouds(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3)  // cloud shadow
    .and(scl.neq(8))     // cloud medium probability
    .and(scl.neq(9))     // cloud high probability
    .and(scl.neq(10))    // thin cirrus
    .and(scl.neq(11));   // snow/ice
  return image.updateMask(mask);
}

function computeNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

// Current month Sentinel-2 NDVI
var s2Current = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(startDate, endDate)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', CLOUD_THRESHOLD))
  .map(maskS2Clouds)
  .map(computeNDVI);

var ndviCurrent = s2Current.select('NDVI').median();

// 5-year baseline NDVI for the same calendar month
var ndviBaselineImages = ee.List.sequence(BASELINE_START, BASELINE_END).map(function(y) {
  y = ee.Number(y).int();
  var bStart = ee.Date.fromYMD(y, MONTH, 1);
  var bEnd = bStart.advance(1, 'month');
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate(bStart, bEnd)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', CLOUD_THRESHOLD))
    .map(maskS2Clouds)
    .map(computeNDVI)
    .select('NDVI')
    .median();
});

var ndviBaseline = ee.ImageCollection.fromImages(ndviBaselineImages).mean();

// NDVI deviation
var ndviDeviation = ndviCurrent.subtract(ndviBaseline)
  .divide(ndviBaseline).multiply(100).rename('NDVI_deviation_pct');

// ============================================================================
// MODIS EVI — 250m Resolution
// ============================================================================

var modisCurrent = ee.ImageCollection('MODIS/061/MOD13Q1')
  .filterDate(startDate, endDate)
  .select('EVI')
  .map(function(img) { return img.multiply(0.0001); });

var eviCurrent = modisCurrent.mean().rename('EVI');

// 5-year baseline EVI
var eviBaselineImages = ee.List.sequence(BASELINE_START, BASELINE_END).map(function(y) {
  y = ee.Number(y).int();
  var bStart = ee.Date.fromYMD(y, MONTH, 1);
  var bEnd = bStart.advance(1, 'month');
  return ee.ImageCollection('MODIS/061/MOD13Q1')
    .filterDate(bStart, bEnd)
    .select('EVI')
    .map(function(img) { return img.multiply(0.0001); })
    .mean();
});

var eviBaseline = ee.ImageCollection.fromImages(eviBaselineImages).mean().rename('EVI_baseline');

var eviDeviation = eviCurrent.subtract(eviBaseline)
  .divide(eviBaseline).multiply(100).rename('EVI_deviation_pct');

// ============================================================================
// ZONAL STATISTICS — Per Zone
// ============================================================================

function computeZonalStats(image, geometry, zoneName, indicatorName) {
  var stats = image.reduceRegion({
    reducer: ee.Reducer.mean()
      .combine(ee.Reducer.stdDev(), null, true)
      .combine(ee.Reducer.minMax(), null, true)
      .combine(ee.Reducer.count(), null, true),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e10
  });

  return ee.Feature(null, stats)
    .set('zone', zoneName)
    .set('indicator', indicatorName)
    .set('year', YEAR)
    .set('month', MONTH)
    .set('boundary_status', 'PLACEHOLDER');
}

// Zone 1: Usangu GR
var z1_ndvi = computeZonalStats(ndviCurrent, zones.usanguReserve, 'Usangu GR', 'NDVI_current');
var z1_ndvi_bl = computeZonalStats(ndviBaseline, zones.usanguReserve, 'Usangu GR', 'NDVI_baseline');
var z1_ndvi_dev = computeZonalStats(ndviDeviation, zones.usanguReserve, 'Usangu GR', 'NDVI_deviation_pct');
var z1_evi = computeZonalStats(eviCurrent, zones.usanguReserve, 'Usangu GR', 'EVI_current');
var z1_evi_bl = computeZonalStats(eviBaseline, zones.usanguReserve, 'Usangu GR', 'EVI_baseline');

// Zone 1 Ihefu Core (highest sensitivity)
var z1i_ndvi = computeZonalStats(ndviCurrent, zones.ihefuCore, 'Ihefu Core', 'NDVI_current');
var z1i_ndvi_bl = computeZonalStats(ndviBaseline, zones.ihefuCore, 'Ihefu Core', 'NDVI_baseline');
var z1i_ndvi_dev = computeZonalStats(ndviDeviation, zones.ihefuCore, 'Ihefu Core', 'NDVI_deviation_pct');

// Zone 2: Nyerere NP
var z2_ndvi = computeZonalStats(ndviCurrent, zones.nyerereNP, 'Nyerere NP', 'NDVI_current');
var z2_ndvi_bl = computeZonalStats(ndviBaseline, zones.nyerereNP, 'Nyerere NP', 'NDVI_baseline');
var z2_ndvi_dev = computeZonalStats(ndviDeviation, zones.nyerereNP, 'Nyerere NP', 'NDVI_deviation_pct');
var z2_evi = computeZonalStats(eviCurrent, zones.nyerereNP, 'Nyerere NP', 'EVI_current');
var z2_evi_bl = computeZonalStats(eviBaseline, zones.nyerereNP, 'Nyerere NP', 'EVI_baseline');

// ============================================================================
// EXPORT RESULTS
// ============================================================================

var allStats = ee.FeatureCollection([
  z1_ndvi, z1_ndvi_bl, z1_ndvi_dev, z1_evi, z1_evi_bl,
  z1i_ndvi, z1i_ndvi_bl, z1i_ndvi_dev,
  z2_ndvi, z2_ndvi_bl, z2_ndvi_dev, z2_evi, z2_evi_bl
]);

Export.table.toDrive({
  collection: allStats,
  description: 'SRA_NDVI_EVI_' + YEAR + '_' + String(MONTH).padStart(2, '0'),
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'ndvi_evi_' + YEAR + '_' + String(MONTH).padStart(2, '0'),
  fileFormat: 'CSV'
});

// ============================================================================
// ALERT DETECTION — Vegetation Stress
// ============================================================================

// Flag pixels with >15% decline (MODERATE) and >25% decline (HIGH)
var moderateAlert = ndviDeviation.lt(-15).selfMask().rename('NDVI_MODERATE');
var highAlert = ndviDeviation.lt(-25).selfMask().rename('NDVI_HIGH');

// Compute area of alert pixels within each zone (km²)
function alertAreaKm2(alertImage, geometry, label) {
  var pixelArea = alertImage.multiply(ee.Image.pixelArea()).divide(1e6);
  var area = pixelArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e10
  });
  return ee.Feature(null, area).set('zone', label);
}

var z1ModArea = alertAreaKm2(moderateAlert, zones.usanguReserve, 'Usangu GR MODERATE');
var z1HighArea = alertAreaKm2(highAlert, zones.usanguReserve, 'Usangu GR HIGH');
var z2ModArea = alertAreaKm2(moderateAlert, zones.nyerereNP, 'Nyerere NP MODERATE');
var z2HighArea = alertAreaKm2(highAlert, zones.nyerereNP, 'Nyerere NP HIGH');

print('=== NDVI/EVI ALERT AREAS (km²) ===');
print('Zone 1 MODERATE:', z1ModArea);
print('Zone 1 HIGH:', z1HighArea);
print('Zone 2 MODERATE:', z2ModArea);
print('Zone 2 HIGH:', z2HighArea);

// ============================================================================
// VISUALISATION
// ============================================================================

var ndviVis = {min: 0, max: 0.8, palette: ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163',
  '99B718', '74A901', '66A000', '529400', '3E8601', '207401', '056201']};

var deviationVis = {min: -30, max: 10, palette: ['d73027', 'fc8d59', 'fee08b', 'ffffbf',
  'd9ef8b', '91cf60', '1a9850']};

Map.centerObject(zones.allZones, 6);
Map.addLayer(ndviCurrent, ndviVis, 'NDVI Current');
Map.addLayer(ndviDeviation, deviationVis, 'NDVI Deviation (%)');
Map.addLayer(moderateAlert, {palette: ['FFA726']}, 'MODERATE Alert Pixels');
Map.addLayer(highAlert, {palette: ['D32F2F']}, 'HIGH Alert Pixels');
