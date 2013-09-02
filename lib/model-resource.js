
var oath    = require('oath');
var async   = require('async');
var yesNo   = require('yes-no');
var models  = require('./models');
var app     = require('./index').app;
var merge   = require('merge-recursive');

// 
// This method creates a Resource instance to serve the given model. It only performs
// basic RESTful actions (with any validation defined in the schema).
// 
exports.createDefaultModelResource = function(name, model, schemaDescription, public, readonlyFields, populateFields) {
	schemaDescription = parseSchema(schemaDescription);
	if (! schemaDescription._id) {
		schemaDescription._id = {type: 'ObjectId', auto: true};
	}

	var idParam = name.split('-').join('') + 'id';
	return app.Resource.create(name, {

		parent: null,
		route: '/' + name + '/:' + idParam + '?',

		public: public || false,

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

				// Build the actual database query
				var query = model
					.find()
					.lean()
					.skip(opts.offset)
					.limit(opts.limit);

				// Handle selecting fields
				if (opts.fields) {
					query.select(opts.fields);
				}

				// Handle field population
				if (opts.populate) {
					query.populate(opts.populate);
				}

				// Handle filtering
				if (opts.filter) {
					try {
						opts.filter = JSON.parse(opts.filter);
					} catch (e) {
						promise.reject(
							new app.Resource.HttpError(400, 'filter parameter JSON was malformed')
						);
						return promise.promise;
					}
					
					try {
						Object.keys(opts.filter).forEach(
							buildFilterQuery.bind(this, query, opts.filter)
						);
					} catch (e) {
						if (e instanceof app.Resource.HttpError) {
							promise.reject(e);
						} else {
							promise.reject(
								new app.Resource.HttpError(500, e)
							);
						}
						return promise.promise;
					}
				}

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

// -------------------------------------------------------------

	function removeReadonlyFields(object) {
		readonlyFields.forEach(function(field) {
			field = field.split('.');

			var scope = object;
			var len = field.length;

			try {
				for (var i = 0, c = len - 1; i < c; i++) {
					scope = scope[field[i]];
				}	
			} catch(e) {return;}

			delete scope[field.pop()];
		});
	}

};

// -------------------------------------------------------------

// 
// Handles building complex queries for the ?filter param
// 

var simpleQueries = [
	'$ne', '$gt', '$lt', '$gte', '$lte', '$in', '$nin',
	'$all', '$size', '$elemMatch', '$exists', '$mod',
	'$near', '$nearSphere'
];

function buildFilterQuery(query, filter, key) {
	filter = filter[key];

	// Handle $or clauses
	if (key === '$or' || key === '$nor') {
		if (Array.isArray(filter)) {
			query[key.slice(1)](filter);
		}

		// Handle syntax error in $or
		else {
			throw new app.Resource.HttpError(400, '$or clause value must be an array');
		}

		return;
	}

	// Handle $where clauses
	if (key === '$where') {
		query.$where(filter);

		return;
	}

	// Start the query...
	query.where(key);

	// Handle exact value queries
	if (typeof filter === 'string') {
		query.equals(filter);
	}

	// Handle more specific cases
	else if (typeof filter === 'object' && filter) {
		// Simple queries
		simpleQueries.forEach(function(op) {
			if (filter[op] != null) {
				query[op.slice(1)](filter[op]);
			}
		});

		// Geometry Queries
		if (filter.$geoWithin != null) {
			query.within.geometry(filter.$geoWithin);
		}
		if (filter.$geoIntersects != null) {
			query.within.geometry(filter.$geoIntersects);
		}

		// Regex Queries
		if (filter.$regex != null) {
			var flags = '';
			var index = null;
			var pattern = filter.$regex;
			
			if (pattern[0] === '/') {
				pattern = pattern.slice(1);
				index = pattern.lastIndexOf('/');
				flags = pattern.slice(index + 1);
				pattern = pattern.slice(0, index);
			}

			query.regex(new RegExp(pattern, flags));
		}
	}
}

// -------------------------------------------------------------

// 
// Creates the formatted schema object sent to /resource/schema requests
// 

function parseSchema(schema) {
	var obj = { };
	
	Object.keys(schema).forEach(function(key) {
		obj[key] = typeObject(schema[key]);
	});

	return obj;
}

function typeObject(type) {
	var obj      = { };
	var def      = { };
	var isArray  = false;

	if (typeof type === 'object' && type) {
		if (Array.isArray(type)) {
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
		case models.types.Mixed:
			obj.type = 'Mixed';
		break;
		case models.types.Email:
			obj.type = 'Email';
		break;
		case models.types.Url:
			obj.type = 'Url';
		break;
		case models.types.ObjectId:
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

	if (def.index) {
		if (def.index.unique) {
			obj.unique = true;
		} else {
			obj.index = true;
		}
	}

	if (def.protected) {
		obj.protected = true;
	}

	if (def.readonly) {
		obj.readonly = true;
	}

	return obj;
}
