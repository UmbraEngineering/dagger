
var oath            = require('oath');
var async           = require('async');
var yesNo           = require('yes-no');
var models          = require('../models');
var app             = require('../index').app;
var queries         = require('./queries');
var schemaParser    = require('./schema-parser');
var readonlyFields  = require('./readonly-fields');
var merge           = require('merge-recursive');

// 
// This method creates a Resource instance to serve the given model. It only performs
// basic RESTful actions (with any validation defined in the schema).
// 
exports.create = function(name, model) {
	var schemaDescription = schemaParser.parse(model._schemaDescription);
	if (! schemaDescription._id) {
		schemaDescription._id = {type: 'ObjectId', auto: true};
	}

	var removeReadonlyFields = readonlyFields.remover(model._readonlyFields);

	var idParam = name.split('-').join('') + 'id';
	return app.Resource.create(name, {

		parent: null,
		route: '/' + name + '/:' + idParam + '?',

		public: model._public || false,

	// -------------------------------------------------------------
	//  GET

		get: function(req) {
			this._get(req).then(
				function(data) {
					req.send(200, data);
				},
				function(err) {
					err.send(req);
				});
		},

		// 
		// Default GET handler
		// 
		_get: function(req) {
			var promise = new oath();
			var id = req.params[idParam];

			if (id) {
				// Handle schema requests
				if (id === 'schema') {
					promise.resolve(schemaDescription);
				}

				// Handle single resource requests
				else {
					var query = model.findById(id).lean().exec(function(err, obj) {
						if (err) {
							var status = (err.message === 'Invalid ObjectId') ? 400 : 500;
							return promise.reject(
								new app.Resource.HttpError(status, err)
							);
						}

						if (! obj) {
							return promise.reject(
								new app.Resource.HttpError(404, 'Document not found')
							);
						}

						// Remove protected fields
						obj = model.sanitize(obj);

						promise.resolve(obj);
					});	
				}
			}
			
			// Load the list endpoint
			else {
				// Default options
				// 
				//   NOTE: This should probably be defined somewhere more global....
				// 
				var opts = {
					limit: 20,
					offset: 0,
					sort: null,
					fields: null,
					populate: null
				};

				// Get a working options object
				merge(opts, req.query || { });

				// Parse the given query data and build a mongo query
				var query = queries.buildQuery(model, opts);
				
				// Make the query
				query.exec(function(err, objs) {
					if (err) {
						return promise.reject(
							new app.Resource.HttpError(500, err)
						);
					}

					objs = objs.map(model.sanitize);

					promise.resolve(objs || [ ]);
				});
			}

			return promise.promise;
		},

	// -------------------------------------------------------------
	//  POST

		post: function(req) {
			var url = req.url;
			this._post(req).then(
				function(data) {
					req.setHeader('Location', url + '/' + data._id);
					req.send(201, data);
				},
				function(err) {
					err.send(req);
				});
		},

		// 
		// Default POST handler
		// 
		_post: function(req) {
			var promise = new oath();

			// Protect readonly fields from being written
			removeReadonlyFields(req.body);

			var object = new model(req.body);
			object.save(function(err) {
				if (err) {
					// Make sure we send an HTTP 400 for validation errors
					if (err.name === 'ValidationError') {
						app.log('MESSAGE', 'Mongoose Validation Error: ' + JSON.stringify(err));
						return promise.reject(
							new app.Resource.HttpError(400, err)
						);
					}

					// Handle dups in unique indexes
					if (err.name === 'MongoError' && err.code === 11000) {
						return promise.reject(
							new app.Resource.HttpError(400, err)
						);
					}
					
					return promise.reject(
						new app.Resource.HttpError(500, err)
					);
				}

				// 
				// TODO:
				//   This sends non-select fields to the client. This needs to be corrected.
				// 
				promise.resolve(object.sanitize());
			});

			return promise.promise;
		},

	// -------------------------------------------------------------
	//  PUT/PATCH

		// 
		// NOTE:
		//   For the time being, there is no difference between PUT and PATCH. Both act as PATCH.
		// 

		put: function(req) {
			this._put(req).then(
				function(data) {
					req.send(200, data);
				},
				function(err) {
					err.send(req);
				});
		},

		_put: function(req) {
			return this._update(req);
		},

		patch: function(req) {
			this._patch(req).then(
				function(data) {
					req.send(200, data);
				},
				function(err) {
					err.send(req);
				});
		},

		_patch: function(req) {
			return this._update(req);
		},

		_update: function(req) {
			var promise = new oath();
			var id = req.params[idParam];
			
			// Handle update to a single object
			//  PUT /blah/:id {...}
			if (id) {
				updateObject(id, req.body, function(err, data) {
					if (err) {
						return promise.reject(err);
					}

					promise.resolve(data);
				});
			}
			
			// Handle multiple updates together
			//  PUT /blah [{...}, {...}, ...]
			else {
				if (! (req.body instanceof Array)) {
					return promise.reject(
						new app.Resource.HttpError(400, 'To PUT to a list endpoint, the request body must contain an array of objects to update')
					);
				}

				async.map(req.body,
					function(object, next) {
						var id = object._id; delete object._id;
						updateObject(id, object, next);
					},
					function(err, results) {
						if (err) {
							return promise.reject(err);
						}

						promise.resolve(results);
					});
			}

			function updateObject(id, data, callback) {
				// Protect readonly fields from being written
				removeReadonlyFields(data);

				model.findById(id, function(err, object) {
					if (err) {
						return callback(
							new app.Resource.HttpError(500, err)
						);
					}

					merge(object, data);
					object.save(function(err, object) {
						if (err) {
							// Make sure we send an HTTP 400 for validation errors
							if (err.name === 'ValidationError') {
								app.log('MESSAGE', 'Mongoose Validation Error: ' + JSON.stringify(err));
								return callback(
									new app.Resource.HttpError(400, err)
								);
							}
							
							return callback(
								new app.Resource.HttpError(500, err)
							);
						}

						callback(null, object.sanitize());
					});
				});
			}

			return promise.promise;
		},

	// -------------------------------------------------------------
	//  DELETE

		del: function(req) {
			this._del(req).then(
				function() {
					req.send(204);
				},
				function(err) {
					err.send(req);
				});
		},

		_del: function(req) {
			var promise = new oath();
			var id = req.params[idParam];
			
			// Handle update to a single object
			//  DELETE /blah/:id
			if (id) {
				deleteObject(id, function(err) {
					if (err) {
						return promise.reject(err);
					}

					promise.resolve();
				});
			}
			
			// Handle multiple updates together
			//  DELETE /blah [id, id, ...]
			else {
				if (! (req.body instanceof Array)) {
					return promise.reject(
						new app.Resource.HttpError(400, 'To DELETE to a list endpoint, the request body must contain an array of ids to delete')
					);
				}

				async.forEach(req.body,
					function(id, next) {
						deleteObject(id, next);
					},
					function(err) {
						if (err) {
							return promise.reject(err);
						}

						promise.resolve();
					});
			}

			function deleteObject(id, callback) {
				model.remove({_id: id}, function(err, count) {
					if (err) {
						return callback(
							new app.Resource.HttpError(500, err)
						);
					}

					if (! count) {
						return callback(
							new app.Resource.HttpError(404, 'No such resource to delete')
						);
					}

					callback();
				});
			}

			return promise.promise;
		}

	});

};
