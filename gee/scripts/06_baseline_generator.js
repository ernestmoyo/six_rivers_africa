/**
 * Six Rivers Africa — Landscape Health Intelligence Dashboard
 * GEE Script 06: Historical Baseline Generator (2018–2023)
 *
 * Generates 5-year monthly baseline statistics for all indicators
 * across both operational zones. Required before operational reporting begins.
 *
 * Output: CSV per indicator per zone, 12 months × 5-year means.
 *
 * Prepared by: Ernest Moyo / 7Square Inc.
 */

var zones = require('users/ernestmoyo/six_rivers_africa:scripts/00_zone_boundaries');

// ============================================================================
// PARAMETERS
// ============================================================================

var BASELINE_START = 2018;
var BASELINE_END = 2023;
var MONTHS = ee.List.sequence(1, 12);
var YEARS = ee.List.sequence(BASELINE_START, BASELINE_END);

// ============================================================================
// NDVI BASELINE — Sentinel-2
// ============================================================================

function computeMonthlyNDVIBaseline(month) {
  month = ee.Number(month).int();

  var monthlyImages = YEARS.map(function(y) {
    y = ee.Number(y).int();
    var start = ee.Date.fromYMD(y, month, 1);
    var end = start.advance(1, 'month');
    return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterDate(start, end)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map(function(img) {
        var scl = img.select('SCL');
        var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
        return img.updateMask(mask).normalizedDifference(['B8', 'B4']).rename('NDVI');
      })
      .median();
  });

  var baseline = ee.ImageCollection.fromImages(monthlyImages).mean();

  // Zonal stats for all three zones
  var zoneGeometries = [
    {geom: zones.usanguReserve, name: 'Usangu GR'},
    {geom: zones.ihefuCore, name: 'Ihefu Core'},
    {geom: zones.nyerereNP, name: 'Nyerere NP'}
  ];

  return zoneGeometries.map(function(z) {
    var stats = baseline.reduceRegion({
      reducer: ee.Reducer.mean().combine(ee.Reducer.stdDev(), null, true),
      geometry: z.geom,
      scale: 30,
      maxPixels: 1e10
    });
    return ee.Feature(null, stats)
      .set('zone', z.name)
      .set('month', month)
      .set('indicator', 'NDVI_baseline')
      .set('period', BASELINE_START + '-' + BASELINE_END);
  });
}

// ============================================================================
// EVI BASELINE — MODIS
// ============================================================================

function computeMonthlyEVIBaseline(month) {
  month = ee.Number(month).int();

  var monthlyImages = YEARS.map(function(y) {
    y = ee.Number(y).int();
    var start = ee.Date.fromYMD(y, month, 1);
    var end = start.advance(1, 'month');
    return ee.ImageCollection('MODIS/061/MOD13Q1')
      .filterDate(start, end)
      .select('EVI')
      .map(function(img) { return img.multiply(0.0001); })
      .mean();
  });

  var baseline = ee.ImageCollection.fromImages(monthlyImages).mean().rename('EVI');

  return [
    {geom: zones.usanguReserve, name: 'Usangu GR'},
    {geom: zones.ihefuCore, name: 'Ihefu Core'},
    {geom: zones.nyerereNP, name: 'Nyerere NP'}
  ].map(function(z) {
    var stats = baseline.reduceRegion({
      reducer: ee.Reducer.mean().combine(ee.Reducer.stdDev(), null, true),
      geometry: z.geom,
      scale: 250,
      maxPixels: 1e10
    });
    return ee.Feature(null, stats)
      .set('zone', z.name)
      .set('month', month)
      .set('indicator', 'EVI_baseline')
      .set('period', BASELINE_START + '-' + BASELINE_END);
  });
}

// ============================================================================
// CHIRPS RAINFALL BASELINE — 30-year climatology
// ============================================================================

function computeMonthlyRainfallBaseline(month) {
  month = ee.Number(month).int();

  var monthlyImages = ee.List.sequence(1981, 2023).map(function(y) {
    y = ee.Number(y).int();
    var start = ee.Date.fromYMD(y, month, 1);
    var end = start.advance(1, 'month');
    return ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
      .filterDate(start, end)
      .sum();
  });

  var climatology = ee.ImageCollection.fromImages(monthlyImages).mean().rename('rainfall_mm');

  return [
    {geom: zones.usanguReserve, name: 'Usangu GR'},
    {geom: zones.ihefuCore, name: 'Ihefu Core'},
    {geom: zones.nyerereNP, name: 'Nyerere NP'}
  ].map(function(z) {
    var stats = climatology.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: z.geom,
      scale: 5566,
      maxPixels: 1e9
    });
    return ee.Feature(null, stats)
      .set('zone', z.name)
      .set('month', month)
      .set('indicator', 'CHIRPS_baseline')
      .set('period', '1981-2023');
  });
}

// ============================================================================
// LST BASELINE — MODIS
// ============================================================================

function computeMonthlyLSTBaseline(month) {
  month = ee.Number(month).int();

  var monthlyImages = YEARS.map(function(y) {
    y = ee.Number(y).int();
    var start = ee.Date.fromYMD(y, month, 1);
    var end = start.advance(1, 'month');
    return ee.ImageCollection('MODIS/061/MOD11A2')
      .filterDate(start, end)
      .select('LST_Day_1km')
      .mean()
      .multiply(0.02)
      .subtract(273.15);
  });

  var baseline = ee.ImageCollection.fromImages(monthlyImages).mean().rename('LST_celsius');

  return [
    {geom: zones.usanguReserve, name: 'Usangu GR'},
    {geom: zones.ihefuCore, name: 'Ihefu Core'},
    {geom: zones.nyerereNP, name: 'Nyerere NP'}
  ].map(function(z) {
    var stats = baseline.reduceRegion({
      reducer: ee.Reducer.mean().combine(ee.Reducer.stdDev(), null, true),
      geometry: z.geom,
      scale: 1000,
      maxPixels: 1e9
    });
    return ee.Feature(null, stats)
      .set('zone', z.name)
      .set('month', month)
      .set('indicator', 'LST_baseline')
      .set('period', BASELINE_START + '-' + BASELINE_END);
  });
}

// ============================================================================
// RUN ALL BASELINES & EXPORT
// ============================================================================

// Note: In practice, run each indicator as a separate GEE task
// to avoid memory limits. This script demonstrates the full pipeline.

// NDVI baseline — all 12 months, all zones
var ndviFeatures = [];
for (var m = 1; m <= 12; m++) {
  ndviFeatures = ndviFeatures.concat(computeMonthlyNDVIBaseline(m));
}

Export.table.toDrive({
  collection: ee.FeatureCollection(ndviFeatures),
  description: 'SRA_Baseline_NDVI',
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'baseline_ndvi_2018_2023',
  fileFormat: 'CSV'
});

// EVI baseline
var eviFeatures = [];
for (var m2 = 1; m2 <= 12; m2++) {
  eviFeatures = eviFeatures.concat(computeMonthlyEVIBaseline(m2));
}

Export.table.toDrive({
  collection: ee.FeatureCollection(eviFeatures),
  description: 'SRA_Baseline_EVI',
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'baseline_evi_2018_2023',
  fileFormat: 'CSV'
});

// Rainfall baseline
var rainFeatures = [];
for (var m3 = 1; m3 <= 12; m3++) {
  rainFeatures = rainFeatures.concat(computeMonthlyRainfallBaseline(m3));
}

Export.table.toDrive({
  collection: ee.FeatureCollection(rainFeatures),
  description: 'SRA_Baseline_CHIRPS',
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'baseline_chirps_1981_2023',
  fileFormat: 'CSV'
});

// LST baseline
var lstFeatures = [];
for (var m4 = 1; m4 <= 12; m4++) {
  lstFeatures = lstFeatures.concat(computeMonthlyLSTBaseline(m4));
}

Export.table.toDrive({
  collection: ee.FeatureCollection(lstFeatures),
  description: 'SRA_Baseline_LST',
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'baseline_lst_2018_2023',
  fileFormat: 'CSV'
});

print('=== BASELINE GENERATION ===');
print('Baseline period: ' + BASELINE_START + '-' + BASELINE_END);
print('Indicators: NDVI, EVI, CHIRPS, LST');
print('Zones: Usangu GR, Ihefu Core, Nyerere NP');
print('Export to Google Drive folder: SixRiversAfrica');
