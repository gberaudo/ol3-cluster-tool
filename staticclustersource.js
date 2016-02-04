goog.provide('ol.source.StaticCluster');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.events.EventType');
goog.require('goog.object');
goog.require('goog.math');
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
 * @param {Array.<number>} distanceFactors
 * @extends {ol.source.Vector}
 * @api
 */
ol.source.StaticCluster = function(options, resolutionSteps, distanceFactors) {
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
   * @type {number}
   * @private
   */
  this.distance_ = goog.isDef(options.distance) ? options.distance : 20;

  /**
   * @type {Array.<number>}
   * @private
   */
  this.distanceRange_ = distanceFactors;

  /**
   * @type {ol.source.Vector}
   * @private
   */
  this.source_ = options.source;

  this.updating = false;

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
  this.source_.loadFeatures(extent, resolution, projection);
};


/**
 * Handle the source changing
 * @private
 */
ol.source.StaticCluster.prototype.onSourceChange_ = function() {
  if (this.updating) {
    return;
  }
  this.updating = true;

  // Regenerate the cluster features for all resolution intervals
  console.log('Source change');
  var stepZeroFeatures = this.source_.getFeatures();
  var featuresAtStep = stepZeroFeatures;

  this.resolutionSteps_.forEach(function(resolution, index) {
    // Create cluster at a given resolution using the features
    // at the previous resolution.
    featuresAtStep = this.clusterFeatures_(featuresAtStep, index);
  }, this);

  this.clear(true);
  this.addFeatures(stepZeroFeatures);
  this.updating = false;
};


/**
 * Create a cluster of features at a given resolution.
 * @param {Array.<ol.Feature>} previousStepFeatures cluster at previous step
 * @param {number} rindex
 * @return {Array.<ol.Feature>} cluster at this resolution
 * @private
 */
ol.source.StaticCluster.prototype.clusterFeatures_ =
    function(previousStepFeatures, rindex) {

  var clusteringResolution = this.resolutionSteps_[rindex];
  console.log('generating cluster at', clusteringResolution);

  if (clusteringResolution === 0) {
    // Special case for resolution 0 where neighboring should be disabled
    previousStepFeatures.forEach(function(feature) {
      feature.set('resolution_index', 0);
    });
    return previousStepFeatures;
  }

  var extent = ol.extent.createEmpty();
  var mapDistance = this.distance_ * clusteringResolution;
  if (this.distanceRange_) {
    var maxResolution = this.resolutionSteps_[this.resolutionSteps_.length - 1];
    var t =  clusteringResolution / maxResolution;
    var lerp = goog.math.lerp;
    mapDistance *= lerp(this.distanceRange_[0], this.distanceRange_[1], t);
  }
  var leafSource = new ol.source.Vector({features: previousStepFeatures});

  /** @type {Array.<ol.Feature>} */
  var featuresAtStep = [];

  /**
   * @type {Object.<string, boolean>}
   */
  var clustered = {};

  previousStepFeatures.forEach(goog.bind(function(feature) {
    var uid = goog.getUid(feature).toString();
    if (!goog.object.containsKey(clustered, uid)) {
      var geometry = feature.getGeometry();
      goog.asserts.assert(geometry instanceof ol.geom.Point);
      var coordinates = geometry.getCoordinates();

      // Find the features close to the current feature
      ol.extent.createOrUpdateFromCoordinate(coordinates, extent);
      ol.extent.buffer(extent, mapDistance, extent);
      var neighbors = leafSource.getFeaturesInExtent(extent);

      // Only keep neighbors not belonging to another cluster
      goog.asserts.assert(neighbors.length >= 1);
      neighbors = goog.array.filter(neighbors, function(neighbor) {
        var nuid = goog.getUid(neighbor).toString();
        if (!goog.object.containsKey(clustered, nuid)) {
          // This neighbor has not been clustered yet.
          // Mark it as clustered and keep it.
          // Note that 'feature' is included in the neighbors.
          clustered[nuid] = true;
          return true;
        } else {
          // Discard already clustered neighbor
          return false;
        }
      });

      // Choose a feature out of the neighbors
      var chosenFeature = this.chooseFeature_(neighbors);

      // Create children array
      var children = [];
      neighbors.forEach(function(f) {
        // Remove chosen feature from children
        if (chosenFeature !== f) {
          children.push(f);
        }
      });

      // Update the 'children' property with the children at this resolution
      var childrenObject = chosenFeature.get('children') || {};
      childrenObject[clusteringResolution] = children;
      chosenFeature.set('children', childrenObject);

      // Update the resolution index property
      chosenFeature.set('resolution_index', rindex);

      // Add the chosen feature to current step features
      featuresAtStep.push(chosenFeature);
    }
  }, this));
  goog.asserts.assert(
      goog.object.getCount(clustered) === previousStepFeatures.length);

  // Return the array of the chosen features for this step
  return featuresAtStep;
};


/**
 * @param {Array.<ol.Feature>} features Features
 * @return {ol.Feature}
 * @private
 */
ol.source.StaticCluster.prototype.chooseFeature_ = function(features) {
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

  return closestFeature;
};
