#!/bin/bash
# Check with jparse

filein=$1
fileout=${2-"$1.geojson"}

echo '{"type":"FeatureCollection", "features": [' > $fileout
while IFS="|" read geom id
do
  echo "{\"geometry\": $geom, \"type\":\"Feature\", \"id\":$id}," >> $fileout
done < $filein
sed -i '$s/.$//' $fileout
echo ']}' >> $fileout
