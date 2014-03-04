
var when              = require('when');
var Endpoint          = require('./base');
var gates             = require('logic-gates');
var HttpError         = require('../http-meta').HttpError;
var merge             = require('merge-recursive');
var endpointInherits  = require('./inherits');

// 
// Create a DetailEndpoint subclass of Endpoint for model default resources
// 
// Has an extra method defined for each CRUD operation which is used internally
// by the HTTP endpoint methods to perform basic REST operations
// 
var DetailEndpoint = module.exports = Endpoint.extend({

	init: function(model) {
		this._super({
			model: model,
			route: '/' + model.route + '/:id',
			public: model.public && model.public.detail,
		});
	},

// --------------------------------------------------------
	
	// 
	// Handle GET requests
	// 
	// Reads one or more objects by their IDs
	// 
	// Example request:
	//   GET /people/{id}
	//   GET /people/{id};{id};{id}
	// 
	get: function(req) {
		this.read(req).then(
			function(objs) {
				req.send(200, objs);
			},
			function(err) {
				err = new HttpError(500, err);
				err.send(req);
			});
	},

	// 
	// Reads objects from mongo
	// 
	read: function(req) {
		var found;
		var model  = this.model;
		var mong   = this.mong;
		var ids    = req.params.id.split(';');
		var isSet  = (ids.length > 1);

		return when.all(
			// First, find all of the requested objects
			ids.map(function(id) {
				return mong.find({ _id: {$in: ids} }).exec()
					.then(function(err, objs) {
						if (err) {
							throw err;
						}

						// Make sure we got everything
						var missing;
						if (! objs || ! objs.length) {
							missing = ids;
						}
						if (objs.length < ids.length) {
							missing = ids.filter(function(id) {
								return !! objs.find(function(obj) {
									return obj.id === id;
								});
							});
						}
						if (missing) {
							throw new HttpError(404, 'Cannot find objects with the IDs ' +
								'"' + missing.join('", "') + '"');
						}

						return objs;
					});
			}))

			// Authorize access to each object
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

				found = found.map(model.sanitize);
				return isSet ? model : found[0];
			});
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
	
	// 
	// Handle PUT requests
	// 
	// Updates an existing object with new data
	// 
	// Example request:
	//   PUT /people/{id}  {"name":"bob"}
	// 
	put: function(req) {
		this.update(req).then(
			function(obj) {
				req.send(200, obj);
			},
			function(err) {
				err = new HttpError(500, err);
				err.send(req);
			});
	},

	// 
	// Handles PATCH requests
	// 
	// Updates an existing object with new data
	// 
	// Example request:
	//   PATCH /people/{id}  {"name":"bob"}
	// 
	patch: function(req) {
		this.update(req).then(
			function(obj) {
				req.send(200, obj);
			},
			function(err) {
				err = new HttpError(500, err);
				err.send(req);
			});
	},

	// 
	// Updating objects with the set syntax doesn't really make a lot of sense given
	// that a request body is required, so that is better handled by the list endpoint
	// system. Therefore, detail endpoint updates only work for single objects.
	// 
	update: function(req) {
		var found;
		var data   = req.body;
		var mong   = this.mong;
		var model  = this.model;

		var id = data._id;
		delete data._id;

		data = model.removeReadonlyProperties(data);

		return this.findById(id).exec()
			// First we find the object
			.then(function(err, obj) {
				if (err) {
					throw err;
				}

				if (! obj) {
					throw new HttpError(404, 'Cannot find the requested object with ID "' + id + '"');
				}

				return found = obj;
			})

			// Next, we authorize the request for this object
			.then(model.authorize.bind(model, req))
			.then(function(authorized) {
				if (! authorized) {
					throw new HttpError(401, 'You are not authorized to make that request');
				}

				return found;
			})

			// Do the actual update
			.then(function(obj) {
				var deferred = when.defer();

				merge(obj, data).save(function(err, obj) {
					if (err) {
						return deferred.reject(err);
					}

					deferred.resolve(obj);
				});

				return deferred;
			});
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
endpointInherits.extend(DetailEndpoint);
