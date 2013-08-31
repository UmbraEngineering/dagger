
var oath    = require('oath');
var yesNo   = require('yes-no');
var models  = require('./models');
var app     = require('./index').app;
var merge   = require('merge-recursive');

// 
// This method creates a Resource instance to serve the given model. It only performs
// basic RESTful actions (with any validation defined in the schema).
// 
exports.createDefaultModelResource = function(name, model, schemaDescription) {
	schemaDescription = parseSchema(schemaDescription);
	schemaDescription._id = {type: 'ObjectId', auto: true};

	return app.Resource.create(name, {

		parent: null,
		route: '/' + name + '/:' + name + 'id?',

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
			var id = req.params[name + 'id'];

			if (id) {
				// Handle schema requests
				if (id === 'schema') {
					promise.resolve(schemaDescription);
				}

				// Handle single resource requests
				else {
					model.findById(id).lean().exec(function(err, obj) {
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
					sort: null
				};

				// Get a working options object
				merge(opts, req.query || { });

				// 
				// TODO:
				//   Add support for filtering
				// 

				// Build the actual database query
				var query = model
					.find()
					.lean()
					.skip(opts.offset)
					.limit(opts.limit);

				// Handle sorting
				if (opts.sort) {
					query.sort(opts.sort);
				}
				
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
			var id = req.params[name + 'id'];
			
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
				model.findById(id, function(err, object) {
					if (err) {
						return callback(
							new app.Resource.HttpError(500, err)
						);
					}

					merge(object, req.body);
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
			var id = req.params[name + 'id'];
			
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

// -------------------------------------------------------------

function parseSchema(schema) {
	var obj = { };
	
	Object.keys(schema).forEach(function(key) {
		obj[key] = typeObject(schema[key]);
	});

	return obj;
}

// -------------------------------------------------------------

var Mixed = models.types.Mixed;
var ObjectId = models.types.ObjectId;

function typeObject(type) {
	var obj      = { };
	var def      = { };
	var isArray  = false;

	if (typeof type === 'object' && type) {
		if (type instanceof Array) {
			isArray = true;
			type = type[0];
		} else {
			if (Object.keys(type).length) {
				if (type.type) {
					def = type;
					type = def.type;	
				} else {
					return {
						type: 'Object',
						tree: parseSchema(type)
					};
				}
			} else {
				type = Object;
			}
		}
	}

	switch (type) {
		case String:
			obj.type = 'String';
			if (def.enum) {
				obj.enum = def.enum.slice()
			}
			if (def.lowercase) {
				obj.lowercase = true;
			}
			if (def.uppercase) {
				obj.uppercase = true;
			}
			if (def.trim) {
				obj.trim = true;
			}
			if (def.match) {
				obj.match = def.match.toString;
			}
		break;
		case Number:
			obj.type = 'Number';
			if (def.min != null) {
				obj.min = def.min;
			}
			if (def.max != null) {
				obj.max = def.max;
			}
		break;
		case Date:
			obj.type = 'Date';
			if (def.expires) {
				obj.expires = def.expires;
			}
		break;
		case Boolean:
			obj.type = 'Boolean';
		break;
		case Array:
			obj.type = 'Array';
		break;
		case Object:
			obj.type = 'Object';
		break;
		case Buffer:
			obj.type = 'Buffer';
		break;
		case Mixed:
			obj.type = 'Mixed';
		break;
		case ObjectId:
			obj.type = 'ObjectId';
			if (def.ref) {
				obj.ref = def.ref;
			}
			if (def.auto) {
				obj.auto = def.auto;
			}
		break;
		default:
			if (isArray) {
				isArray = false;
				obj.type = 'Array';
			}
		break;
	}

	if (isArray) {
		obj.type = '[' + obj.type + ']';
	}

	return obj;
}
