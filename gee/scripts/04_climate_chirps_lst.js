/**
 * Six Rivers Africa — Landscape Health Intelligence Dashboard
 * GEE Script 04: Climate Context — CHIRPS Rainfall & MODIS LST
 *
 * CHIRPS v2.0 rainfall anomaly and MODIS Land Surface Temperature
 * for contextualising vegetation and fire signals.
 *
 * Prepared by: Ernest Moyo / 7Square Inc.
 */

var zones = require('users/ernestmoyo/six_rivers_africa:scripts/00_zone_boundaries');

// ============================================================================
// PARAMETERS
// ============================================================================

var YEAR = 2026;
var MONTH = 1;
var BASELINE_START = 2018;
var BASELINE_END = 2023;
var CHIRPS_CLIM_START = 1981; // 30-year climatology baseline
var CHIRPS_CLIM_END = 2023;

var startDate = ee.Date.fromYMD(YEAR, MONTH, 1);
var endDate = startDate.advance(1, 'month');

// ============================================================================
// CHIRPS v2.0 — Monthly Rainfall & Anomaly
// ============================================================================

// Current month total rainfall
var chirpsCurrent = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterDate(startDate, endDate)
  .sum()
  .rename('rainfall_mm');

// 30-year climatological mean for same calendar month
var chirpsClimImages = ee.List.sequence(CHIRPS_CLIM_START, CHIRPS_CLIM_END).map(function(y) {
  y = ee.Number(y).int();
  var bStart = ee.Date.fromYMD(y, MONTH, 1);
  var bEnd = bStart.advance(1, 'month');
  return ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate(bStart, bEnd)
    .sum();
});

var chirpsClimatology = ee.ImageCollection.fromImages(chirpsClimImages)
  .mean()
  .rename('rainfall_30yr_mean');

// Rainfall anomaly (percentage deviation from 30-year mean)
var rainfallAnomaly = chirpsCurrent.subtract(chirpsClimatology)
  .divide(chirpsClimatology)
  .multiply(100)
  .rename('rainfall_anomaly_pct');

// Zonal statistics
function rainfallZonalStats(geometry, zoneName) {
  var currentStats = chirpsCurrent.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 5566,
    maxPixels: 1e9
  });
  var climStats = chirpsClimatology.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 5566,
    maxPixels: 1e9
  });
  var anomalyStats = rainfallAnomaly.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 5566,
    maxPixels: 1e9
  });
  return ee.Feature(null, {
    'rainfall_mm': currentStats.get('rainfall_mm'),
    'rainfall_30yr_mean': climStats.get('rainfall_30yr_mean'),
    'rainfall_anomaly_pct': anomalyStats.get('rainfall_anomaly_pct')
  })
    .set('zone', zoneName)
    .set('indicator', 'CHIRPS_rainfall')
    .set('year', YEAR)
    .set('month', MONTH);
}

var z1Rain = rainfallZonalStats(zones.usanguReserve, 'Usangu GR');
var z1iRain = rainfallZonalStats(zones.ihefuCore, 'Ihefu Core');
var z2Rain = rainfallZonalStats(zones.nyerereNP, 'Nyerere NP');

// ============================================================================
// MODIS MOD11A2 — Land Surface Temperature
// ============================================================================

var lstCollection = ee.ImageCollection('MODIS/061/MOD11A2')
  .filterDate(startDate, endDate)
  .select('LST_Day_1km');

// Convert from Kelvin (scaled) to Celsius: value * 0.02 - 273.15
var lstCurrent = lstCollection.mean()
  .multiply(0.02)
  .subtract(273.15)
  .rename('LST_celsius');

// 5-year baseline LST for same calendar month
var lstBaselineImages = ee.List.sequence(BASELINE_START, BASELINE_END).map(function(y) {
  y = ee.Number(y).int();
  var bStart = ee.Date.fromYMD(y, MONTH, 1);
  var bEnd = bStart.advance(1, 'month');
  return ee.ImageCollection('MODIS/061/MOD11A2')
    .filterDate(bStart, bEnd)
    .select('LST_Day_1km')
    .mean()
    .multiply(0.02)
    .subtract(273.15);
});

var lstBaseline = ee.ImageCollection.fromImages(lstBaselineImages)
  .mean()
  .rename('LST_baseline');

var lstAnomaly = lstCurrent.subtract(lstBaseline).rename('LST_anomaly_C');

// Zonal statistics
function lstZonalStats(geometry, zoneName) {
  var currentStats = lstCurrent.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 1000,
    maxPixels: 1e9
  });
  var baselineStats = lstBaseline.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 1000,
    maxPixels: 1e9
  });
  var anomalyStats = lstAnomaly.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 1000,
    maxPixels: 1e9
  });
  return ee.Feature(null, {
    'LST_celsius': currentStats.get('LST_celsius'),
    'LST_baseline': baselineStats.get('LST_baseline'),
    'LST_anomaly_C': anomalyStats.get('LST_anomaly_C')
  })
    .set('zone', zoneName)
    .set('indicator', 'LST')
    .set('year', YEAR)
    .set('month', MONTH);
}

var z1LST = lstZonalStats(zones.usanguReserve, 'Usangu GR');
var z1iLST = lstZonalStats(zones.ihefuCore, 'Ihefu Core');
var z2LST = lstZonalStats(zones.nyerereNP, 'Nyerere NP');

// ============================================================================
// ALERT DETECTION
// ============================================================================

// Rainfall deficit >40% = HIGH drought watch
var droughtAlert = rainfallAnomaly.lt(-40).selfMask().rename('drought_alert');

// LST anomaly >3°C = MODERATE thermal stress
var thermalAlert = lstAnomaly.gt(3).selfMask().rename('thermal_alert');

// ============================================================================
// EXPORT
// ============================================================================

var allClimateStats = ee.FeatureCollection([
  z1Rain, z1iRain, z2Rain,
  z1LST, z1iLST, z2LST
]);

Export.table.toDrive({
  collection: allClimateStats,
  description: 'SRA_Climate_' + YEAR + '_' + String(MONTH).padStart(2, '0'),
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'climate_' + YEAR + '_' + String(MONTH).padStart(2, '0'),
  fileFormat: 'CSV'
});

// ============================================================================
// VISUALISATION
// ============================================================================

var rainVis = {min: 0, max: 200, palette: ['#FFFFCC', '#A1DAB4', '#41B6C4', '#2C7FB8', '#253494']};
var anomalyVis = {min: -60, max: 20, palette: ['#D73027', '#FC8D59', '#FEE08B', '#D9EF8B', '#91CF60', '#1A9850']};
var lstVis = {min: 20, max: 45, palette: ['blue', 'yellow', 'orange', 'red']};

Map.centerObject(zones.allZones, 6);
Map.addLayer(chirpsCurrent, rainVis, 'Rainfall (mm)');
Map.addLayer(rainfallAnomaly, anomalyVis, 'Rainfall Anomaly (%)');
Map.addLayer(lstCurrent, lstVis, 'LST (°C)');
Map.addLayer(lstAnomaly, {min: -3, max: 6, palette: ['blue', 'white', 'red']}, 'LST Anomaly (°C)');
Map.addLayer(droughtAlert, {palette: ['D32F2F']}, 'Drought Alert (>40% deficit)');
Map.addLayer(thermalAlert, {palette: ['FF6F00']}, 'Thermal Stress (>3°C anomaly)');
