#!/bin/bash

for file in `ls raw`
do
  echo -n "Converting raw/$file to geojson "
  ./poi_dump_to_geojson.sh raw/$file input/${file}.geojson
  echo
done

phantomjs generate-clusters.js
