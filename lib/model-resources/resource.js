
var oath            = require('oath');
var async           = require('async');
var yesNo           = require('yes-no');
var models          = require('../models');
var app             = require('../index').app;
var queries         = require('./queries');
var fetchScope      = require('./fetch-scope');
var schemaParser    = require('./schema-parser');
var readonlyFields  = require('./readonly-fields');
var merge           = require('merge-recursive');
var ObjectId        = require('mongoose/node_modules/mongodb');
var httpMeta        = require('../http-meta');
var utils           = require('../utils');

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
		route: new RegExp('/' + name + '(/.*)?'),

		public: model._public || false,

	// -------------------------------------------------------------
	//  GET

		get: function(req) {
			var self = this;

			self._get(req).then(
				function(data) {
					self.callHook('after::get', req, data, function(err) {
						if (err) {
							err = new app.Resource.HttpError(500, err);
							return err.send(req);
						}

						req.send(200, data);
					});
				},
				function(err) {
					err.send(req);
				});
		},

		// 
		// Default GET handler
		// 
		_get: function(req) {
			var self = this;
			var promise = new oath();

			self.initRequest('get', req).then(
				function(scopeChain) {
					var last = scopeChain.pop();

					switch (last.type) {

						// Schema endpoint
						case 'schema':
							if (last.value) {
								promise.resolve(last.value);
							} else {
								promise.reject(
									new app.Resource.HttpError(404, 'Document not found')
								);
							}
						break;

						// List endpoint
						case 'list':
							var filter = req.query.filter;
							if (filter && filter._id) {
								var ids = last.value.map(function(obj) {
									return obj._id;
								});

								if (typeof filter._id === 'object') {
									if (filter._id.$in) {
										// Get an intersection of the given IDs and the allowed ones
										filter._id.$in = filter._id.$in.filter(function(id) {
											return (ids.indexOf(id) >= 0);
										});
									} else {
										filter._id.$in = ids;
									}
								} else if (typeof filter._id === 'string') {
									if (ids.indexOf(filter._id) < 0) {
										promise.reject(
											new app.Resource.HttpError(404, 'Document not found')
										);
									}
								} else {
									filter._id = {$in: ids};
								}
							}
						// passthrough

						case 'model':
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

								objs = objs.map(last.model.sanitize);

								promise.resolve(objs || [ ]);
							});
						break;

						// Detail endpoint
						case 'ref':
							// Allow field populations with queries, eg.
							//   GET /foos/123?populate=field1,field2
							if (req.query.populate) {
								last.model
									.findById(last.value._id)
									.populate(populate)
									.exec(function(err, obj) {
										if (err || ! obj) {
											return new app.Resource.HttpError(500, err || 'Something is really wrong...');
										}

										promise.resolve(obj.sanitize());
									});

								return;
							}

							promise.resolve(last.value);
						break;

						// Specific value endpoint
						case 'value':
							promise.resolve(JSON.stringify(last.value));
						break;

					}
				},
				function(err) {
					if (! (err instanceof app.Resource.HttpError)) {
						err = new app.Resource.HttpError(500, err);
					}

					promise.reject(err);
				});
			

			return promise.promise;
		},

		// 
		// Return the schema definition if schema endpoints are enabled
		// 
		_schema: function(req) {
			if (app.conf.endpoints.schema) {
				return schemaDescription;
			}
		},

	// -------------------------------------------------------------
	//  POST

		post: function(req) {
			var self = this;
			var url = req.url;

			self._post(req).then(
				function(data) {
					self.callHook('after::post', req, data, function(err) {
						if (err) {
							err = new app.Resource.HttpError(500, err);
							return err.send(req);
						}

						req.setHeader('Location', url + '/' + data._id);
						req.send(201, data);
					});
				},
				function(err) {
					err.send(req);
				});
		},

		// 
		// Default POST handler
		// 
		_post: function(req) {
			var self = this;
			var promise = new oath();

			// Protect readonly fields from being written
			removeReadonlyFields(req.body);

			self.initRequest('post', req).then(
				function(scopeChain) {
					var last    = scopeChain.pop();
					var list    = scopeChain.pop();
					var parent  = scopeChain.pop();

					if (last.type !== 'model' && last.type !== 'list') {
						return promise.reject(
							new app.Resource.HttpError(400, 'POST requests only allowed on list endpoints')
						);
					}
					
					var object = new last.model(req.body);
					object.save(function(err) {
						if (err) {
							// Make sure we send an HTTP 400 for validation errors
							if (err.name === 'ValidationError') {
								app.log('MESSAGE', 'Mongoose Validation Error: ' + JSON.stringify(err));
								return promise.reject(
									new app.Resource.HttpError(400, err)
								);
							}

							// Handle dupes in unique indexes
							if (err.name === 'MongoError' && err.code === 11000) {
								return promise.reject(
									new app.Resource.HttpError(400, err)
								);
							}
							
							return promise.reject(
								new app.Resource.HttpError(500, err)
							);
						}

						// Re-fetch the object so that post-processing and non-select fields will take affect
						last.model.findById(object._id, function(err, object) {
							if (! parent) {
								return promise.resolve(object.sanitize());
							}

							// If this is not a top-level list, we should add a reference to the new object
							// in it's parent object. For example, `POST /foos/123/bars` will create a new
							// bars instance and add a reference to /foos/123 in the bars list.
							parent.model.findById(parent._id, function(err, parent) {
								if (err) {
									return promise.reject(
										new app.Resource.HttpError(500, err)
									);
								}

								if (! parent) {
									app.log('ERROR', 'Something went seriously wrong here...', utils.stacktrace());
									return promise.reject(
										new app.Resource.HttpError(500, 'Something went really wrong here...')
									);
								}

								parent[list.uri].push(object._id);
								parent.save(function(err) {
									promise.resolve(object.sanitize());
								});
							});
						});
					});
				},
				function(err) {
					promise.reject(err);
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
			var self = this;

			self._put(req).then(
				function(data) {
					self.callHook('after::put', req, data, function(err) {
						if (err) {
							err = new app.Resource.HttpError(500, err);
							return err.send(req);
						}

						req.send(200, data);
					});
				},
				function(err) {
					err.send(req);
				});
		},

		_put: function(req) {
			return this._update(req);
		},

		patch: function(req) {
			var self = this;

			self._patch(req).then(
				function(data) {
					self.callHook('after::patch', req, data, function(err) {
						if (err) {
							err = new app.Resource.HttpError(500, err);
							return err.send(req);
						}

						req.send(200, data);
					});
				},
				function(err) {
					err.send(req);
				});
		},

		_patch: function(req) {
			return this._update(req);
		},

		_update: function(req) {
			var self = this;
			var promise = new oath();

			self.initRequest(req.method, req).then(
				function(scopeChain) {
					var last   = scopeChain.pop();
					var prev   = scopeChain.pop();
					var data   = req.body;
					var model  = last.model;

					switch (last.type) {
						// Schema endpoint
						case 'schema':
							promise.reject(
								new app.Resource.HttpError(400, 'Cannot make a ' + req.method.toUpperCase() + ' request on a schema endpoint')
							);
						break;

						// Detail endpoint
						case 'ref':
							data._id = last.uri;
							data = [data];
						break;

						// Specific value endpoint
						case 'value':
							var value = data;
							data = {_id: prev.uri};
							data[last.uri] = value;
							data = [data];
						break;

						// List endpoint
						case 'list':
						case 'model':
							if (! Array.isArray(req.body)) {
								process.nextTick(function() {
									promise.reject(
										new app.Resource.HttpError(400, 'To PUT to a list endpoint, the request body must contain an array of objects to update')
									);
								});
								return promise.promise;
							}
						break;
					}

					async.map(data,
						function(data, done) {
							var id = data._id; delete data._id;

							// Protect readonly fields from being written
							removeReadonlyFields(data);

							model.findById(id, function(err, object) {
								if (err) {
									return done(err);
								}

								if (! object) {
									return done(
										new app.Resource.HttpError(404, 'Could not find object with ID "' + id + '"')
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

									done(null, object.sanitize());
								});
							});
						},
						function(err, data) {
							if (err) {
								promise.reject(err);
							}

							if (last.type !== 'model' && last.type !== 'list') {
								data = data[0];
							}

							promise.resolve(data);
						});
				},
				function(err) {
					if (! (err instanceof app.Resource.HttpError)) {
						err = new app.Resource.HttpError(500, err);
					}

					promise.reject(err);
				});
			

			return promise.promise;
		},

	// -------------------------------------------------------------
	//  DELETE

		del: function(req) {
			var self = this;

			self._del(req).then(
				function(data) {
					self.callHook('after::delete', req, data, function(err) {
						if (err) {
							err = new app.Resource.HttpError(500, err);
							return err.send(req);
						}

						req.send(204, data);
					});
				},
				function(err) {
					err.send(req);
				});
		},

		_del: function(req) {
			var self = this;
			var promise = new oath();

			self.initRequest(req.method, req).then(
				function(scopeChain) {
					var last   = scopeChain.pop();
					var prev   = scopeChain.pop();
					var data   = req.body;
					var model  = last.model;

					switch (last.type) {
						// Schema endpoint
						case 'schema':
							promise.reject(
								new app.Resource.HttpError(400, 'Cannot make a DELETE request on a schema endpoint')
							);
						break;

						// Detail endpoint
						case 'ref':
							data = [last.uri];
						break;

						// Specific value endpoint
						case 'value':
							promise.reject(
								new app.Resource.HttpError(400, 'Cannot make a DELETE request on a value endpoint')
							);
						break;

						// List endpoint
						case 'list':
						case 'model':
							if (! Array.isArray(req.body)) {
								process.nextTick(function() {
									promise.reject(
										new app.Resource.HttpError(400, 'To DELETE to a list endpoint, the request body must contain an array of ids to delete')
									);
								});
								return promise.promise;
							}
						break;
					}

					async.map(data,
						function(id, done) {
							model.remove({_id: id}, function(err, count) {
								if (err) {
									return done(
										new app.Resource.HttpError(500, err)
									);
								}

								if (! count) {
									return done(
										new app.Resource.HttpError(404, 'Object with ID "' + id + '" not found')
									);
								}

								done();
							});
						},
						function(err, data) {
							if (err) {
								promise.reject(err);
							}

							promise.resolve();
						});
				},
				function(err) {
					if (! (err instanceof app.Resource.HttpError)) {
						err = new app.Resource.HttpError(500, err);
					}

					promise.reject(err);
				});
			

			return promise.promise;
		},

	// -------------------------------------------------------------

		callHook: function(hook) {
			hook = hook.split('::');

			var args = Array.prototype.slice.call(arguments, 1);
			var funcs = (model._httpHooks[hook[1]] || { })[hook[0]] || [ ];
			var callback = args.pop();

			async.forEachSeries(funcs,
				function(func, next) {
					func.apply(this, args.concat(next));
				},
				callback);
		},

		checkPermissions: function(req, method, scopeChain) {
			var promise = new oath();

			var verb = httpMeta.verbs[method];
			var lastIndex = scopeChain.length - 1;
			var model = scopeChain[lastIndex].model;

			// Check for permission to make the request
			req.auth.hasPermission(model.modelName + '.' + verb, scopeChain.slice(), req).then(
				function(hasPerm) {
					promise.resolve(hasPerm);
				},
				function(err) {
					promise.reject(err);
				});

			return promise.promise;
		},

		initRequest: function(method, req) {
			var self = this;
			var promise = new oath();

			self.callHook('before::' + method, req, function() {
				fetchScope(model, req.url, req.body).then(
					function(scopeChain) {
						self.checkPermissions(req, method, scopeChain).then(
							function(hasPermission) {
								if (hasPermission) {
									promise.resolve(scopeChain);
								} else {
									promise.reject(
										new app.Resource.HttpError(401)
									);
								}
							},
							function(err) {
								promise.reject(err);
							});
					},
					function(err) {
						promise.reject(err);
					});
			});

			return promise.promise;
		}

	});

};
