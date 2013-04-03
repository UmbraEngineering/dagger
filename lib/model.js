
exports.initialize = function(app) {
	Class.namespace(app);
	
	// 
	// Model Class
	// 

	Class('Model').Extends('AppObject', {

		// 
		// Model pooling
		// =============
		// 
		// Single model instance for each "object" in the database. The model class
		// should have a static hash containing all "active" models of that class.
		// Then, the Model class should have a lookup by ID routinue that first checks
		// this hash for an already existing model before creating a new instance
		// that way all active connections share the same instance and stay in sync.
		// 
		// This will need to be kept track of in multiple places to ensure efficiency.
		// Model instances will need both a list of all active socket connections as
		// well as a running count of all non-socket (REST API) connections. When both
		// the list is empty and the count hits 0, then we know it is safe to gc that
		// model instance.
		// 
		state: {
			restApiConnections: 0,
			socketConnections: [
				// ...
			]
		}

		// 
		// Mutliple app server instances
		// =============================
		// 
		// It should at least be supported (if not as a default feature, then at least
		// as a config option) to use a redis event bus to syncronize mutliple instances
		// of a dagger app. This avoids the problem of multiple instances updating the
		// database separate of each other and getting out of sync. This should probably
		// be controlled by the AppObject with events being emitted for remote changes
		// to any models.
		// 

	});

};
