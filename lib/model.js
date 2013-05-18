
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

	// ------------------------------------------------------------------

		// 
		// This method connects the model instance to a redis bus and starts listening
		// for relevant events.
		// 
		_connectToRedisBus: function(bus) {
			this.redisBus = bus;

			// 
			// TODO: Start listening for events relevant to this model instance
			// 
		},

	// -------------------------------------------------------------

		// 
		// Destroy the model instance and ready it for GC
		// 
		destroy: function() {
			// 
		}

	});

};
