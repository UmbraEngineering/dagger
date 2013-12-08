
var when       = require('when');
var Endpoint   = require('./base');
var gates      = require('logic-gates');
var HttpError  = require('../http-meta').HttpError;
var merge      = require('merge-recursive');

// 
// Create a ListEndpoint subclass of Resource for model default resources
// 
// Has an extra method defined for each CRUD operation which is used internally
// by the HTTP endpoint methods to perform basic REST operations
// 
var ListEndpoint = module.exports = Endpoint.extend({

	init: function(model) {
		this._super({
			model: model,
			route: '/' + model.route,
			public: model.public && model.public.list,
		});
	},

// --------------------------------------------------------
	
	// 
	// Handle GET requests
	// 
	// Fetches results based on request params
	// 
	// Example request:
	//   GET /people?filter={"name":"bob"}
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
	// The default lookup routine for list GET requests
	// 
	read: function(req) {
		var results;
		var model = this.model;

		// Query mongo for the requested models
		return this.buildQuery(req.query).exec()
			.then(function(objs) {
				results = objs;
				return when.all(
					(objs || [ ]).map(model.authorize.bind(model, req))
				);
			})
			.then(function(authorized) {
				results = results.filter(function(obj, index) {
					return authorized[index];
				});
				return results.map(model.sanitize);
			});
	},

// --------------------------------------------------------
	
	// 
	// Handle POST requests
	// 
	// Creates a new object in the database with the data in the request body
	// 
	// Example request:
	//   POST /people   {"name":"bob","email":"bob@example.com"}
	// 
	post: function(req) {
		this.create(req).then(
			function(obj) {
				req.send(201, obj.toObject());
			},
			function(err) {
				err = new HttpError(500, err);
				err.send(req);
			});
	},

	// 
	// Create and save a new model instance with the data given
	// 
	create: function(req) {
		return this.model.authorize(req, req.data)
			.then(function(authorized) {
				var deferred = when.defer();

				var data = this.model.removeReadonlyFields(req.data);
				this.model.create(data).save(function(err, obj) {
					if (err) {
						return deferred.reject(err);
					}

					promise.resolve(obj);
				});

				return deferred.promise;
			});
	},

// --------------------------------------------------------
	
	// 
	// Handle PUT requests
	// 
	// Updates a set of existing objects using the data given
	// 
	// Example request:
	//   PUT /people   [{"_id":{id},"name":"bob"},{"_id":{id},"email":"bob@example.com"}]
	// 
	put: function(req) {
		this.update(req).then(
			function(results) {
				req.send(200, results);
			},
			function(err) {
				err = new HttpError(500, err);
				err.send(req);
			});
	},

	// 
	// Handle PATCH requests
	// 
	// Updates a set of existing objects using the data given
	// 
	// Example request:
	//   PUT /people   [{"_id":{id},"name":"bob"},{"_id":{id},"email":"bob@example.com"}]
	// 
	patch: function(req) {
		this.update(req).then(
			function(results) {
				req.send(200, results);
			},
			function(err) {
				err = new HttpError(500, err);
				err.send(req);
			});
	},

	// 
	// Updates a set of objects based on the data provided
	// 
	update: function(req) {
		var found;
		var mong   = this.mong;
		var model  = this.model;
		var data   = req.body;

		if (! Array.isArray(data)) {
			return when.reject(new HttpError(400, 'Must receive an array of objects to update'));
		}

		return when.all(
			// First, make sure all of the objects we are updating can be found
			data.map(function(data) {
				var id = data._id;
				delete data._id;

				return mong.findById(id).exec()
					.then(function(err, obj) {
						if (err) {
							throw new HttpError(500, err);
						}

						if (! obj) {
							throw new HttpError(404, 'Object with the ID "' + id + '" was not found');
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

			// Next, update each object with the data given for that object
			.then(function() {
				return when.all(
					found.map(function(obj, index) {
						var deferred = when.defer();
						var objData = model.removeReadonlyFields(data[index]);

						merge(obj, objData).save(function(err, obj) {
							if (err) {
								return deferred.reject(err);
							}

							promise.resolve(model.sanitize(obj));
						});

						return deferred.promise;
					}));
			});
	},

// --------------------------------------------------------

	// 
	// We do not currently support any kind of DELETE requests on
	// list endpoints. For bulk deletes, use the set format, eg.
	// 
	//   DELETE /people/{id};{id};{id}
	// 
	del: null,

});

// --------------------------------------------------------

// 
// Provide some pass-through methods for easy querying; These will only ever
// be used if someone is writing custom endpoint code, which should be the
// exception, not the rule
// 
['find', 'findOne', 'findById'].forEach(function(method) {
	ListEndpoint.prototype[method] = function() {
		return this.mong[method].apply(this.mong, arguments);
	};
});
