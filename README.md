Instructions for generating clustered geojson

Check the resolutionSteps match the tilegrid resolutions of the application.
Put your raw files in raw directory

Run 'make'


Debug:
- put a geojson in input/dump_geojson_bus_fragments.geojson
- launch a python server with python -m SimpleHTTPServer then
- open http://localhost:8000/

Example:
Copy examples/raw/* in raw/ then run make
