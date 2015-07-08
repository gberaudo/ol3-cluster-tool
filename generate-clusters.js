var ol = require('./node_modules/openlayers/build/ol-debug');
var fs = require('fs');
var system = require('system');

// Grid for which resolutions the clustering will be computed
var clusterResolutions = [0, 20, 100, 250, 500, 1000, 1500, 2000, 3000];
var clusterDistance = 20;

var format = new ol.format.GeoJSON();

function exportClusterHierarchy(clusterSource) {
  var features = clusterSource.getSource().getFeatures();
  var epsg3857 = ol.proj.get('EPSG:3857');
  var epsg4326 = ol.proj.get('EPSG:4326');
  features = features.map(function(f) {
    var clone = f.clone();
    clone.unset('features');
    // Keep only the ids of the children features
    var children = clone.get('children') || {};
    for (var resolution in children) {
      var values = children[resolution];
      if (values.length === 0) {
        delete children[resolution];
      } else {
        children[resolution] = values.map(function(childFeature) {
          return childFeature.getId();
        });
      }
    }
    clone.unset('kind');
    var rindex = clone.get('resolution_index');
    if (rindex != clusterResolutions.length -1) {
      clone.set('resolution', clusterResolutions[rindex + 1]);
    } else {
      clone.set('resolution', clusterResolutions[rindex] * 1.5);
    }
    clone.unset('resolution_index');
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
      distance: clusterDistance,
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

var args = system.args;
var infilenames;
if (args.length === 1) {
  infilenames = fs.list('./input/');
} else {
  infilenames = args.slice(1).map(function(fullname) {
    if (fullname.indexOf('input/') === -1) {
      console.log('Error, all input filenames should start with input/', fullname);
      phantom.exit();
    }
    return fullname.substring(fullname.lastIndexOf('/') + 1);
  });
}

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
