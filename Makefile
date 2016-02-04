RAW_FILES := $(shell ls raw/*)
INPUT_FILES := $(patsubst raw/%,input/%.geojson,$(RAW_FILES))
OUTPUT_FILES := $(patsubst raw/%,output/clustered_%.geojson,$(RAW_FILES))


build: $(OUTPUT_FILES)


.build/ol3.timestamp: package.json staticclustersource.js .build/node-modules.timestamp
	@mkdir -p $(@D)
	cp staticclustersource.js node_modules/openlayers/src/ol/source/
	(cd node_modules/openlayers/ && make build)
	@touch $@


.build/node-modules.timestamp: package.json
	@mkdir -p $(@D)
	npm install
	@touch $@


input/%.geojson: raw/% 
	./poi_dump_to_geojson.sh $< $@


output/clustered_%.geojson: input/%.geojson .build/ol3.timestamp generate-clusters.js .build/node-modules.timestamp
	node_modules/phantomjs-prebuilt/bin/phantomjs generate-clusters.js $<
