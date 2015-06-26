var ol = require('./ol3/build/ol-debug');
var fs = require('fs');


// Grid for which resolutions the clustering will be computed
var clusterResolutions = [0, 20, 100, 250, 500, 1000, 1500, 2000, 3000];

var format = new ol.format.GeoJSON();

function exportClusterHierarchy(clusterSource) {
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
  return features;
}


function generateCluster(infile, outfile) {
  try {
    var json = fs.read(infile);
    console.log('Read', json.length, 'characters from', infile);

    var features = format.readFeatures(json,
        {featureProjection: 'EPSG:3857'});

    var source = new ol.source.Vector({
      features: features
    });

    var clusterSource = new ol.source.StaticCluster({
      distance: 40,
      source: source
    }, clusterResolutions);

    source.changed();

    var clusteredFeatures = exportClusterHierarchy(clusterSource);
    var result = format.writeFeatures(clusteredFeatures);
    fs.write(outfile, result, 'w');
    console.log('Wrote', clusteredFeatures.length, 'clustered features to', outfile);
    console.log('');
  } catch (e) {
    console.log('Error generating clustering for', infile)
    console.log(e.stack);
    phantom.exit();
  }
}


var infilenames = fs.list('./input/');
for (var i = 0; i < infilenames.length; ++i) {
  var infile = './input/' + infilenames[i];
  var outfile = './output/clustered_' + infilenames[i];

  if (!fs.isFile(infile)) {
    continue;
  }

  generateCluster(infile, outfile);
}

if (infilenames.length === 0) {
  console.log('Put the geojson files to cluster in the "input" directory');
  console.log('Get the output files from the "output" directory');
}

phantom.exit();
