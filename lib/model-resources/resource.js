
var oath            = require('oath');
var async           = require('async');
var yesNo           = require('yes-no');
var models          = require('../models');
var app             = require('../index').app;
var queries         = require('./queries');
var schemaParser    = require('./schema-parser');
var readonlyFields  = require('./readonly-fields');
var merge           = require('merge-recursive');
var ObjectId        = require('mongoose/node_modules/mongodb');

var defaultFetchParams = {
	limit: 20,
	offset: 0,
	sort: null,
	fields: null,
	populate: null
};

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

	return app.Resource.create(name, {
		model: model,

		parent: null,
		route: '/' + name + '/**',

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

			var uri = req.url.split('/');

			switch (uri[2]) {
				// 
				// Schema endpoint
				// 
				case 'schema':
					process.nextTick(function() {
						if (app.conf.endpoints.schema) {
							promise.resolve(schemaDescription);
						} else {
							promise.reject(
								new app.Resource.HttpError(404, 'Document not found')
							);
						}
					});
				break;
				
				// 
				// Top-level list endpoint
				// 
				case '':
				case undefined:
					// Get a working options object
					var opts = merge({ }, defaultFetchParams, req.query || { });

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
				break;
				
				// 
				// Detail endpoints and sub-resources
				// 
				default:
					this._fetchScope(uri).then(
						function(scope, scopeChain) {
							// 
						},
						function(err) {
							// 
						});
				break;
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
		},

	// -------------------------------------------------------------

		// 
		// Fetches a scope chain for a complex URI given the URI segments array, eg.
		// 
		//   GET /posts/123/comments/234/author/comments
		// 
		// Given as this array:
		// 
		//   ["posts", "123", "comments", "234", "author", "comments"]
		// 
		// Does something like this (simplified chaining, obviously)
		//   
		//   Posts.find(123).comments.find(234).author.comments
		// 
		// And will return a final scope and scope chain:
		// 
		//   function(scope, chain)
		//     scope: comments:234.author.comments
		//     chain: [Post, post:123, post:123.comments, comments:234, comments:234.author]
		// 
		_fetchScope: function(uri) {
			var promise = new oath();

			var scope = model;
			var scopeChain = [ ];

			uri = uri.slice(2);
			async.whilst(uri.length,
				function(next) {
					var segment = uri.shift();

				// -------------------------------------------------------------
				//  If the current scope is a model, fetch the appropriate entry by ID

					if (typeof scope === 'function' && scope.findById) {
						scope.findById(segment, function(err, obj) {
							if (err) {
								return next(new app.Resource.HttpError(500, err));
							}

							if (! obj) {
								return next(new app.Resource.HttpError(404, 'Document not found'));
							}

							// Store the result
							scope = obj;
							scopeChain.push(obj);
							next();
						});
					}

				// -------------------------------------------------------------
				//  If the scope is a model instance

					else if (scope instanceof app.models.mongoose.Model) {
						// Always attempt to populate the field before grabbing it
						scope.populate(segment, function(err, obj) {
							if (err) {
								// This means the field is not and ObjectId. That's fine, ignore it and move on..
								if (err.name === 'CastError' && err.type === 'ObjectId') {
									// pass
								} else {
									return next(new app.Resource.HttpError(500, err));
								}
							}

							// Store the result
							scope = obj[segment];
							scopeChain.push(obj[segment]);
							next();
						});
					}

				// -------------------------------------------------------------
				//  If the scope is an array of subdocuments

					else if (scope instanceof Array) {
						var result;
						scope.some(function(obj) {
							if (obj.id === segment) {
								result = segment;
								return true;
							}
						});

						// Store the result
						scope = result;
						scopeChain.push(result);
						next();
					}

				// -------------------------------------------------------------
				//  Handle unexpected segments

					else {
						next(new app.Resource.HttpError(400, 'Invalid request URI; Unexpected URI segment "' + segment + '"'));
					}
				},

				// async.whilst callback
				function(err) {
					if (err) {
						return promise.reject(err);
					}

					promise.resolve(scopeChain.pop(), scopeChain);
				});

			return promise.promise;
		}

	});

};
