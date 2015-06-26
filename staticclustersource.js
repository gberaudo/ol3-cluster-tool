goog.provide('ol.source.StaticCluster');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.events.EventType');
goog.require('goog.object');
goog.require('ol.Feature');
goog.require('ol.coordinate');
goog.require('ol.extent');
goog.require('ol.geom.Point');
goog.require('ol.source.Vector');



/**
 * Compute a list of clusters based on a list of resolutions.
 * A cluster position is chosen among the positions of the features it
 * aggegates.
 * Each feature of the source vector is associated the resolution at which
 * it is visible for the first time.
 * Export resolution of first appearance of the underlying features.
 * @constructor
 * @param {olx.source.ClusterOptions} options
 * @param {Array.<number>} resolutionSteps
 * @extends {ol.source.Vector}
 * @api
 */
ol.source.StaticCluster = function(options, resolutionSteps) {
  goog.base(this, {
    attributions: options.attributions,
    extent: options.extent,
    logo: options.logo,
    projection: options.projection
  });


  /**
   * Intervals where the clustering will be computed.
   * @type {Array.<number>}
   * @private
   */
  this.resolutionSteps_ = resolutionSteps;


  /**
   * @type {Array.<Array.<ol.Feature>>}
   * @private
   */
  this.resolutionFeatures_ = [];


  /**
   * @type {number|undefined}
   * @private
   */
  this.resolution_ = undefined;


  /**
   * @type {number}
   * @private
   */
  this.distance_ = goog.isDef(options.distance) ? options.distance : 20;


  this.lastUpdatedFeaturesIndex = -1;

  /**
   * @type {ol.source.Vector}
   * @private
   */
  this.source_ = options.source;

  this.clusterResolutionsById = undefined;

  this.source_.on(goog.events.EventType.CHANGE,
      ol.source.StaticCluster.prototype.onSourceChange_, this);
};
goog.inherits(ol.source.StaticCluster, ol.source.Vector);


/**
 * Get a reference to the wrapped source.
 * @return {ol.source.Vector} Source.
 * @api
 */
ol.source.StaticCluster.prototype.getSource = function() {
  return this.source_;
};


/**
 * @inheritDoc
 */
ol.source.StaticCluster.prototype.loadFeatures = function(extent, resolution,
    projection) {
  // First load the underlying source features
  this.source_.loadFeatures(extent, resolution, projection);

  // Select the set of clustered features to show
  if (resolution !== this.resolution_ && this.resolutionSteps_.length > 0 &&
      this.resolutionFeatures_.length > 0) {
    console.log('Res', resolution);
    this.resolution_ = resolution;
    var nextIdx = goog.array.findIndex(this.resolutionSteps_, function(r) {
      return r >= resolution;
    });
    var idx = nextIdx - 1;
    if (idx === -2) {
      idx = this.resolutionSteps_.length - 1;
    }
    if (idx == this.lastUpdatedFeaturesIndex) {
      console.log('Skipped updating feature for same index', idx);
      return;
    }
    this.clear();
    console.log('Updating feature with features at index', idx);
    this.addFeatures(this.resolutionFeatures_[idx]);
    this.lastUpdatedFeaturesIndex = idx;
  }
};


/**
 * Handle the source changing
 * @private
 */
ol.source.StaticCluster.prototype.onSourceChange_ = function() {
  // Regenerate the cluster features for all resolution intervals
  console.log('Source change');
  var features = this.source_.getFeatures();
  this.resolutionFeatures_.length = 0;
  var steps = this.resolutionSteps_;
  steps.every(function(resolution) {
    // Create cluster at a given resolution using the features
    // at the previous resolution.
    features = this.clusterFeatures_(resolution, features);
    this.resolutionFeatures_.push(features);
    return true; // features.length > 1; // as of now we require
    // this.resolutionSteps.length == this.resolutionFeatures_.length
  }, this);
  console.log('Generated',
      this.resolutionFeatures_.reduce(function(previous, current, i, all) {
        return previous + ' (' + steps[i] + ', ' + current.length + ')';
      }, ''));

  this.clusterResolutionsById = this.getMinVisibilityResolutionsById();
  this.changed();
};


/**
 * Compute the resolution at which is underlying feature starts to be visible
 * (eventually as the owner of a cluster).
 * @api
 * @return {Object.<string, number>} resolution by feature id
 */
ol.source.StaticCluster.prototype.getMinVisibilityResolutionsById = function() {
  var resolutionSteps = this.resolutionSteps_;
  var clustersByStep = this.resolutionFeatures_;
  var resolutionsById = {};

  // FIXME: hardcoding some maximum cut resolution value
  var resolution = resolutionSteps[resolutionSteps.length - 1] * 1.5;

  var populateResolutionsById = goog.bind(function(cluster) {
    var idstr = cluster.getId().toString();
    if (!resolutionsById[idstr]) {
      // It is the first time we encountered this feature id.
      // The source feature with this id will be displayed starting from
      // the previous resolution.
      resolutionsById[idstr] = resolution;
    }
  }, this);

  for (var i = resolutionSteps.length - 1; i >= 0; --i) {
    var clusters = clustersByStep[i];
    clusters.forEach(populateResolutionsById);
    resolution = resolutionSteps[i];
  }

  return resolutionsById;
};


/**
 * Create a cluster of features at a given resolution.
 * @param {number} resolution
 * @param {Array.<ol.Feature>} leafFeatures cluster at previous resolution
 * @return {Array.<ol.Feature>} cluster at this resolution
 * @private
 */
ol.source.StaticCluster.prototype.clusterFeatures_ = function(resolution,
    leafFeatures) {
  console.log('generating cluster for', resolution);
  /** @type {Array.<ol.Feature>} */
  var clusterFeatures = [];

  if (resolution === 0) {
    // Special case for resolution 0 where neighboring should be disabled
    leafFeatures.forEach(goog.bind(function(feature) {
      var newClusterFeature = this.createCluster_([feature]);
      newClusterFeature.set('resolution', 0);
      clusterFeatures.push(newClusterFeature);
    }, this));
    return clusterFeatures;
  }

  var extent = ol.extent.createEmpty();
  var mapDistance = this.distance_ * resolution;
  var leafSource = new ol.source.Vector({features: leafFeatures});

  /**
   * @type {Object.<string, boolean>}
   */
  var clustered = {};

  leafFeatures.forEach(goog.bind(function(feature) {
    if (!goog.object.containsKey(clustered, goog.getUid(feature).toString())) {
      var geometry = feature.getGeometry();
      goog.asserts.assert(geometry instanceof ol.geom.Point);
      var coordinates = geometry.getCoordinates();
      ol.extent.createOrUpdateFromCoordinate(coordinates, extent);
      ol.extent.buffer(extent, mapDistance, extent);

      var neighbors = leafSource.getFeaturesInExtent(extent);
      goog.asserts.assert(neighbors.length >= 1);
      neighbors = goog.array.filter(neighbors, function(neighbor) {
        var uid = goog.getUid(neighbor).toString();
        if (!goog.object.containsKey(clustered, uid)) {
          // This neighbor has not been clustered yet.
          // Mark it as clustered and keep it in the list
          clustered[uid] = true;
          return true;
        } else {
          // Discard already clustered neighbor
          return false;
        }
      });
      var newClusterFeature = this.createCluster_(neighbors);
      newClusterFeature.set('resolution', resolution);
      clusterFeatures.push(newClusterFeature);
    }
  }, this));
  goog.asserts.assert(
      goog.object.getCount(clustered) === leafFeatures.length);
  return clusterFeatures;
};


/**
 * @param {Array.<ol.Feature>} features Features
 * @return {ol.Feature}
 * @private
 */
ol.source.StaticCluster.prototype.createCluster_ = function(features) {
  var length = features.length;
  var centroid = [0, 0];
  features.forEach(function(feature) {
    var geometry = feature.getGeometry();
    goog.asserts.assert(geometry instanceof ol.geom.Point);
    var coordinates = geometry.getCoordinates();
    ol.coordinate.add(centroid, coordinates);
  });
  ol.coordinate.scale(centroid, 1 / length);

  var closestFeature;
  var closestDistance = Infinity;
  features.forEach(function(feature) {
    var geometry = feature.getGeometry();
    goog.asserts.assert(geometry instanceof ol.geom.Point);
    var coordinates = geometry.getCoordinates();
    var distance = Math.pow(coordinates[0] - centroid[0], 2) +
        Math.pow(coordinates[1] - centroid[1], 2);
    if (distance < closestDistance) {
      closestFeature = feature;
    }
  });
  var cluster = closestFeature.clone();
  cluster.setId(closestFeature.getId());
  cluster.set('features', features);
  return cluster;
};
