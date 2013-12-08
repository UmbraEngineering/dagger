
var when      = require('when');
var Resource  = require('./resource');
var gates     = require('logic-gates');
var merge     = require('merge-recursive');

// 
// Create a DetailEndpoint subclass of Resource for model default resources
// 
var DetailEndpoint = module.exports = Resource.extend({

	init: function(model) {
		this._super({
			model: model,
			route: '/' + model.route + '/:id',
			public: model.public && model.public.detail,
		});
	},

// --------------------------------------------------------

	get: function(req) {
		// 
	},

	read: function(req) {
		// 
	},

// --------------------------------------------------------
	
	// 
	// We do not currently support any form of POST requests on the
	// detail endpoints. To create new objects use the list endpoint:
	// 
	// POST /people  {...}
	// 
	post: null,

// --------------------------------------------------------

	put: function(req) {
		// 
	},

	patch: function(req) {
		// 
	},

	update: function(req) {
		// 
	},

// --------------------------------------------------------
	
	// 
	// Handle DELETE requests
	// 
	// Deletes the objects matching the given IDS
	// 
	// Example request:
	//   DELETE /people/{id}
	//   DELETE /people/{id};{id};{id}
	// 
	del: function(req) {
		this.destroy(req).then(
			function() {
				req.send(204);
			},
			function(err) {
				err = new HttpError(500, err);
				err.send(req);
			});
	},

	// 
	// Delete objects from mongo
	// 
	destroy: function(req) {
		var found;
		var mong   = this.mong;
		var model  = this.model;

		// This should result in an array of ids, whether doing a single or bulk operation
		var ids = req.params.id.split(';');

		if (! Array.isArray(ids)) {
			return when.reject(new HttpError(400, 'Must receive an array of ObjectIds to delete'));
		}

		return when.all(
			// First, look up the objects for each given ID
			ids.map(function(id) {
				return mong.findById(id).exec()
					.then(function(err, obj) {
						if (err) {
							throw new HttpError(500, err);
						}

						if (! obj) {
							throw new HttpError(404, 'Cannot find object with id "' + id + '"');
						}

						return obj;
					});
			}))

			// Next, we authorize the request for each object
			.then(function(objs) {
				found = objs;
				return when.all(
					objs.map(model.authorize.bind(model, req))
				);
			})
			.then(function(authorized) {
				// If one or more objects failed authorization...
				if (authorized.reduce(gates.nand, true)) {
					 throw new HttpError(401, 'You are not authorized to make that request');
				}

				return found;
			})

			// Assuming nothing went wrong in the previous steps, we can now delete the objects
			.then(function(objs) {
				return when.all(
					objs.map(function(obj) {
						var deferred = when.defer();
						obj.remove(function(err) {
							if (err) {
								return deferred.reject(new HttpError(500, err));
							}

							deferred.resolve();
						});
						return deferred.promise;
					}));
			});
	}

});

// --------------------------------------------------------

// 
// Provide some pass-through methods for easy querying; These will only ever
// be used if someone is writing custom endpoint code, which should be the
// exception, not the rule
// 
['find', 'findOne', 'findById'].forEach(function(method) {
	DetailEndpoint.prototype[method] = function() {
		return this.mong[method].apply(this.mong, arguments);
	};
});
