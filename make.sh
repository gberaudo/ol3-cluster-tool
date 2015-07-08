#!/bin/bash

basedir=`dirname $0`

for file in `ls raw`
do
  echo -n "Converting raw/$file to geojson "
  $basedir/poi_dump_to_geojson.sh raw/$file input/${file}.geojson
  echo
done

$basedir/node_modules/phantomjs/bin/phantomjs generate-clusters.js
