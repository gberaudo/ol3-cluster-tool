/*
goog.require('ol.Feature');
goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.format.GeoJSON');
goog.require('ol.interaction.Select');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.proj');
goog.require('ol.source.MapQuest');
goog.require('ol.source.StaticCluster');
goog.require('ol.source.Vector');
goog.require('ol.style.Circle');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');
goog.require('ol.style.Text');
*/


var source = new ol.source.Vector({
  features: []
});


var oReq = new XMLHttpRequest();
oReq.onload = function() {
  var format = new ol.format.GeoJSON();
  var features = format.readFeatures(this.responseText,
      {featureProjection: 'EPSG:3857'});
  source.addFeatures(features);
};
oReq.open('get', 'input/dump_geojson_bus_fragments.geojson', true);
oReq.send();

var clusterResolutions = [0, 20, 100, 250, 500, 1000, 1500, 2000, 3000];
var clusterSource = new ol.source.StaticCluster({
  distance: 40, // meters
  source: source
}, clusterResolutions);

var styleCache = {};
var clusters = new ol.layer.Vector({
  source: clusterSource,
  style: function(feature, resolution) {
    var rindex = feature.get('resolution_index')
    var firstAppearanceResolution = clusterResolutions[rindex];
    if (resolution > firstAppearanceResolution) {
      return null;
    }
    var childResolution = 0;
    for (var i = clusterResolutions.length; i > -1; --i) {
      var r = clusterResolutions[i];
      if (r <= resolution) {
        childResolution = r;
        break;
      }
    }
    var children = feature.get('children') || {childResolution: []};
    var size = childResolution > 0 ? children[childResolution].length : 0;
    var style = styleCache[size];
    if (!style) {
      style = [new ol.style.Style({
        image: new ol.style.Circle({
          radius: 10,
          stroke: new ol.style.Stroke({
            color: '#fff'
          }),
          fill: new ol.style.Fill({
            color: '#3399CC'
          })
        }),
        text: new ol.style.Text({
          text: size.toString(),
          fill: new ol.style.Fill({
            color: '#fff'
          })
        })
      })];
      styleCache[size] = style;
    }
    return style;
  }
});

var raster = new ol.layer.Tile({
  source: new ol.source.MapQuest({layer: 'sat'})
});


var map = new ol.Map({
  layers: [raster, clusters],
  renderer: 'canvas',
  target: 'map',
  view: new ol.View({
    center: [0, 0],
    zoom: 2
  })
});

var select = new ol.interaction.Select();
map.addInteraction(select);
select.on('select', function(e) {
  var features = e.target.getFeatures();
  console.log('Selected', features.getLength());
  var hierarchy = function(feature) {
    var hiddenFeatures = feature.get('features');
    if (!hiddenFeatures || hiddenFeatures.length == 1) {
      return feature.getId();
    } else {
      return hiddenFeatures.map(hierarchy);
    }
  };
  features.forEach(function(feature) {
    var hiddenFeatures = feature.get('features');
    console.log('Hidding', hiddenFeatures.length, hierarchy(feature));
  });
});


function exportClusterHierarchyAsGeoJSON() {
  var features = clusterSource.getSource().getFeatures();
  var epsg3857 = ol.proj.get('EPSG:3857');
  var epsg4326 = ol.proj.get('EPSG:4326');
  features = features.map(function(f) {
    var clone = f.clone();
    clone.unset('features');
    clone.unset('kind');
    clone.set('resolution', clusterSource.clusterResolutionsById[f.getId()]);
    clone.setId(f.getId());
    clone.getGeometry().transform(epsg3857, epsg4326);
    return clone;
  });
  var format = new ol.format.GeoJSON();
  var str = format.writeFeatures(features);
  var blob = new Blob([str], {'type': 'plain/text'});
  var a = document.getElementById('url');
  a.download = "clustered.json";
  a.href = window.URL.createObjectURL(blob);
  a.textContent = 'Download ready';
  return str;
}
