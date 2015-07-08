RAW_FILES := $(shell ls raw/*)
INPUT_FILES := $(patsubst raw/%,input/%.geojson,$(RAW_FILES))
OUTPUT_FILES := $(patsubst raw/%,output/clustered_%.geojson,$(RAW_FILES))


build: $(OUTPUT_FILES)


.build/ol3.timestamp: package.json staticclustersource.js
	mkdir -p $(@D)
	cp staticclustersource.js node_modules/openlayers/src/ol/source/
	(cd node_modules/openlayers/ && make build)
	touch $@


input/%.geojson: raw/% 
	./poi_dump_to_geojson.sh $< $@


output/clustered_%.geojson: input/%.geojson .build/ol3.timestamp generate-clusters.js
	node_modules/phantomjs/bin/phantomjs generate-clusters.js $<
