Instructions for generating clustered geojson


Prerequisites:
Install phantomjs.

Verify the ol3 submodule has been checked out and copy
./staticclustersource.js to ol3/src/ol/source/

Compile OpenLayers3 with static cluster support.
cd ol3 && make build


Generation:
Create the geojson sources (see ol3/poi_dump_to_geojson.sh)

Put the source geojsons in the 'input' directory.

Check the resolutionSteps match the tilegrid resolutions of the application.

Run the tool
phantomjs generate-clusters.js

Get the clustered files from the 'output' directory.


Debug:
Launch a python server with python -m SimpleHTTPServer then
open index.html
