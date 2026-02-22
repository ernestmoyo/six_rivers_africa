/**
 * Six Rivers Africa — Landscape Health Intelligence Dashboard
 * GEE Script 05: Land Cover Change & Deforestation Detection
 *
 * Sources: ESA WorldCover v200, Hansen Global Forest Change
 * Detects deforestation, agricultural expansion, and wetland shrinkage.
 *
 * Prepared by: Ernest Moyo / 7Square Inc.
 */

var zones = require('users/ernestmoyo/six_rivers_africa:scripts/00_zone_boundaries');

// ============================================================================
// ESA WORLDCOVER v200 — 10m Land Cover Classification
// ============================================================================

var worldCover = ee.Image('ESA/WorldCover/v200').select('Map');

// Land cover classes relevant to Six Rivers Africa zones
var LC_CLASSES = {
  10: 'Tree cover',
  20: 'Shrubland',
  30: 'Grassland',
  40: 'Cropland',
  50: 'Built-up',
  60: 'Bare / sparse vegetation',
  80: 'Permanent water bodies',
  90: 'Herbaceous wetland',
  95: 'Mangroves',
  100: 'Moss and lichen'
};

// Compute land cover composition per zone
function landCoverComposition(geometry, zoneName) {
  var areaImage = ee.Image.pixelArea().divide(1e6); // km²

  var stats = worldCover.addBands(areaImage).reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 0,
      groupName: 'landcover_class'
    }),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e12
  });

  return ee.Feature(null, {
    'land_cover_groups': stats.get('groups')
  })
    .set('zone', zoneName)
    .set('indicator', 'land_cover_composition')
    .set('source', 'ESA WorldCover v200');
}

var z1LC = landCoverComposition(zones.usanguReserve, 'Usangu GR');
var z1iLC = landCoverComposition(zones.ihefuCore, 'Ihefu Core');
var z2LC = landCoverComposition(zones.nyerereNP, 'Nyerere NP');

// ============================================================================
// HANSEN GLOBAL FOREST CHANGE — Deforestation Monitoring
// ============================================================================

var gfc = ee.Image('UMD/hansen/global_forest_change_2023_v1_11');

// Tree cover in 2000 (baseline)
var treeCover2000 = gfc.select('treecover2000');

// Loss year (1-23 = 2001-2023)
var lossYear = gfc.select('lossyear');

// Total forest loss area per zone
function forestLossArea(geometry, zoneName, yearStart, yearEnd) {
  var lossMask = lossYear.gte(yearStart).and(lossYear.lte(yearEnd));
  var lossArea = lossMask.multiply(ee.Image.pixelArea()).divide(1e6);
  var total = lossArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e10
  });
  return ee.Feature(null, total)
    .set('zone', zoneName)
    .set('indicator', 'forest_loss_km2')
    .set('period', yearStart + '-' + yearEnd);
}

// Recent loss (2020-2023) for trend detection
var z1Loss2020_23 = forestLossArea(zones.usanguReserve, 'Usangu GR', 20, 23);
var z1iLoss2020_23 = forestLossArea(zones.ihefuCore, 'Ihefu Core', 20, 23);
var z2Loss2020_23 = forestLossArea(zones.nyerereNP, 'Nyerere NP', 20, 23);

// Historical loss (2001-2019) for baseline context
var z1LossHist = forestLossArea(zones.usanguReserve, 'Usangu GR', 1, 19);
var z2LossHist = forestLossArea(zones.nyerereNP, 'Nyerere NP', 1, 19);

// Annual loss time series (for trend analysis)
var annualLossZ1 = ee.List.sequence(1, 23).map(function(yr) {
  yr = ee.Number(yr).int();
  var lossMask = lossYear.eq(yr);
  var area = lossMask.multiply(ee.Image.pixelArea()).divide(1e6).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: zones.usanguReserve,
    scale: 30,
    maxPixels: 1e10
  });
  return ee.Feature(null, area)
    .set('zone', 'Usangu GR')
    .set('year', ee.Number(2000).add(yr));
});

var annualLossZ2 = ee.List.sequence(1, 23).map(function(yr) {
  yr = ee.Number(yr).int();
  var lossMask = lossYear.eq(yr);
  var area = lossMask.multiply(ee.Image.pixelArea()).divide(1e6).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: zones.nyerereNP,
    scale: 30,
    maxPixels: 1e10
  });
  return ee.Feature(null, area)
    .set('zone', 'Nyerere NP')
    .set('year', ee.Number(2000).add(yr));
});

// ============================================================================
// ENCROACHMENT DETECTION — Agricultural Boundary Analysis
// ============================================================================

// Detect cropland within 5km buffer of reserve boundary
var reserveBuffer = zones.usanguReserve.buffer(5000).difference(zones.usanguReserve);
var croplandInBuffer = worldCover.eq(40).selfMask();
var bufferCropArea = croplandInBuffer.multiply(ee.Image.pixelArea()).divide(1e6)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: reserveBuffer,
    scale: 10,
    maxPixels: 1e12
  });

print('=== ENCROACHMENT ANALYSIS ===');
print('Cropland within 5km buffer of Usangu GR (km²):', bufferCropArea);

// ============================================================================
// EXPORT
// ============================================================================

var allLCStats = ee.FeatureCollection([
  z1LC, z1iLC, z2LC,
  z1Loss2020_23, z1iLoss2020_23, z2Loss2020_23,
  z1LossHist, z2LossHist
]);

Export.table.toDrive({
  collection: allLCStats,
  description: 'SRA_LandCover',
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'land_cover_change',
  fileFormat: 'CSV'
});

var annualLossFC = ee.FeatureCollection(annualLossZ1)
  .merge(ee.FeatureCollection(annualLossZ2));

Export.table.toDrive({
  collection: annualLossFC,
  description: 'SRA_Annual_Forest_Loss',
  folder: 'SixRiversAfrica',
  fileNamePrefix: 'annual_forest_loss_2001_2023',
  fileFormat: 'CSV'
});

// ============================================================================
// VISUALISATION
// ============================================================================

var lcVis = {
  min: 10, max: 100,
  palette: [
    '006400', // 10 - Tree cover
    'FFBB22', // 20 - Shrubland
    'FFFF4C', // 30 - Grassland
    'F096FF', // 40 - Cropland
    'FA0000', // 50 - Built-up
    'B4B4B4', // 60 - Bare
    '0064C8', // 80 - Water
    '0096A0', // 90 - Wetland
    '00CF75', // 95 - Mangroves
    'FAE6A0'  // 100 - Moss
  ]
};

Map.centerObject(zones.allZones, 6);
Map.addLayer(worldCover, lcVis, 'ESA WorldCover');
Map.addLayer(lossYear.gte(20).selfMask(), {palette: ['FF0000']}, 'Forest Loss 2020-2023');
Map.addLayer(croplandInBuffer.clip(reserveBuffer), {palette: ['FF69B4']}, 'Cropland in Usangu Buffer');
