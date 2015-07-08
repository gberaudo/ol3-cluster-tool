#!/bin/bash
# Check with jparse

filein=$1
fileout=${2-"$1.geojson"}

echo '{"type":"FeatureCollection", "features": [' > $fileout
while read p
do
  geom=`echo $p | cut -d\| -f 1`
  id=`echo $p | cut -d\| -f 2`
  echo "{\"geometry\": $geom, \"type\":\"Feature\", \"id\":$id}," >> $fileout
  echo -n "."
done < $filein
sed -i '$s/.$//' $fileout
echo ']}' >> $fileout
