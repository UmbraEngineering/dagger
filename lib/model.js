
exports.initialize = function(app) {
	Class.namespace(app);
	
	// 
	// Model Class
	// 

	Class('Model').Extends('AppObject', {

		// 
		// Set the default livePush value based on the value in the config. This can
		// be overriden on a per model class basis.
		// 
		livePush: app.conf.sockets.livePush,

		// 
		// Base constructor inherited by all model sub-classes. Model classes should
		// use an {initialize} method for constructor type functions in preference to
		// overriding this method.
		// 
		construct: function() {
			this.construct.parent(this);

			if (typeof this.initialize === 'function') {
				this.initialize.apply(this, arguments);
			}
		},

	// -------------------------------------------------------------

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
		},

		// 
		// Tests if the model instance is still needed (has active connections) and
		// if it is not, destroys the instance.
		// 
		_testNeed: function() {
			if (! this.state.restApiConnections && ! this.state.socketConnections.length) {
				// 
				// TODO: Destroy the instance
				// 
			}
		},

		// 
		// This should be called when a new REST API connection is made that needs this
		// model. It will increase the connection count so that we can track the current
		// need of this model instance and returns a function that should be called when
		// the given connection is closed.
		// 
		addRestApiConnection: function() {
			// Bump the number of active connections
			this.state.restApiConnections++;

			// The function returned is to be called when the requested API connection
			// is done. It will decrement the REST API connection counter and then check
			// if the model instance is still needed.
			return this._getRestApiDecrementor();
		},

		// 
		// Returns a one time use function that will decrement the REST API connection
		// counter and then re-test the need of this model instance.
		// 
		_getRestApiDecrementor: function() {
			var func = function() {
				func = function() { };

				// Decrement the number of active connections
				this.state.restApiConnections--;

				// Test if this model instance is still needed
				this._testNeed();
			}.bind(this);

			return function() {
				return func();	
			};
		},

		// 
		// Adds a socket.io connection to the list of active connections and starts
		// listening for messages.
		// 
		addSocketConnection: function(connection) {
			// Add the connection to the list
			this.state.socketConnections.push(connection);

			// 
			// TODO: Add event listeners here
			// 

			// The function returned should be called when the socket connection is closed
			// or the client marks this model instance as no longer needed (this case is
			// handled internally above). The function will remove the socket from the list,
			// remove all event listeners, and then test if this model instance is still
			// needed.
			return this._getSocketRemover(connection);
		},

		// 
		// Returns a one time use function that removes the given socket connection from
		// the state listing, removes all event listeners for the connection, and then tests
		// if the model instance is still needed.
		// 
		_getSocketRemover: function(connection) {
			var func = function() {
				func = function() { };

				// Find the connection in the list and remove it
				var index = this.state.socketConnections.indexOf(connection);
				if (index >= 0) {
					this.state.socketConnections.splice(index, 1);
				}

				// Test if this model instance is still needed
				this._testNeed();
			}.bind(this);

			return function() {
				return func();
			};
		},

	// ------------------------------------------------------------------

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
		redisBus: null,

		// 
		// This method connects the model instance to a redis bus and starts listening
		// for relevant events.
		// 
		_connectToRedisBus: function(bus) {
			this.redisBus = bus;

			// 
			// TODO: Start listening for events relevant to this model instance
			// 
		}

	});

};
