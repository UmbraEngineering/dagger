
var dagger     = require('../index');
var paths      = require('../paths');
var conf       = require('../config');
var mongoose   = require('./mongoose');
var HttpError  = require('../http/error');
var queries    = require('./queries');
var AllowAll   = require('./authorization/allow-all');
var Promise    = require('promise-es6').Promise;

exports.Schema  = mongoose.Schema;
exports.types   = mongoose.Schema.Types;

exports.modelCache = { };

// 
// Loads and returns a specific model
// 
// @param {model} the model path relative to the models directory
// 
exports.require = function(model) {
	if (! exports.modelCache[model]) {
		var name = model.split('/').join('-');
		var path = paths.resolve('models', model);
		var cached = exports.modelCache[model] = require(path);

		Object.defineProperty(cached, 'model', {
			enumerable: true,
			configurable: true,
			// Use a getter here so that the model is only defined the first time it is accessed, as
			// opposed to creating the model when the model's module is loaded. This allows requiring
			// and accessing schemas freely without initializing models, making it easier to make sure
			// schemas are declared in the correct order when dealing with circular references.
			get: function() {
				// Remove the no longer needed getter
				delete cached.model;
				// Redifine cached.model to be the generated model object
				Object.defineProperty(cached, 'model', {
					enumerable: true,
					configurable: false,
					writeable: false,
					value: exports.create(name, cached.schema, cached.auth)
				});

				return cached.model;
			}
		});
	}

	return exports.modelCache[model];
};

// 
// Creates a new mongoose model from a schema after adding some internal static methods
// 
// @param {name} the model name
// @param {schema} the schema as it has been defined so far
// @param {auth} the authorization model to use
// @return object
// 
exports.create = function(name, schema, auth) {
	// If no authorization model is defined, default to allowing everything
	auth = auth || new AllowAll();

/*
	// Mark the model as new if it is
	schema.pre('save', function(done) {
		this.wasNew = this.isNew;
		done();
	});

	// List for save events
	schema.post('save', function() {
		if (conf.redis.enabled) {
			if (this.wasNew) {
				// Emit a create event
				redis.emit([name, 'create'].join(':'), this.toObject());
			} else {
				// Emit an update event
				redis.emit([name, 'update'].join(':'), this.toObject());
			}
		}
	});

	// Listen for remove events
	schema.post('remove', function() {
		if (conf.redis.enabled) {
			redis.emit([name, 'remove'].join(':'), this.toObject());
		}
	});

	// Create the subscription method, used for watching the redis bus for
	// push events. This is used for socket.io live pushing
	schema.statics.subscribe = function(event, callback) {
		if (arguments.length === 1) {
			callback = event;
			event = 'create';
		}

		redis.on([name, event].join(':'), callback);
	};

	// Remove a previously set event subscription
	schema.statics.unsubscribe = function(event, callback) {
		if (arguments.length === 1) {
			callback = event;
			event = 'create';
		}

		redis.off([name, event].join(':'), callback);
	};
*/

// -------------------------------------------------------------

	// 
	// Add the schema description method, but only if one was not already defined
	// 
	// @param {opts} optional; additional options
	// @return object
	// 
	if (! schema.static.schemaDescription) {
		schema.statics.schemaDescription = function(opts) {
			opts = opts || { };
			opts.exclude = opts.exclude || [ ];

			var result = { };

			Object.keys(schema.paths).forEach(function(key) {
				if (opts.exclude.indexOf(key) >= 0) {
					return;
				}

				var path = schema.paths[key];
				var desc = result[key] = { };
				
				if (path.instance) {
					desc.type = path.instance;
				} else {
					var type = path.options.type;
					var isArray = Array.isArray(type);
					
					if (isArray) {
						type = type[0];
					}

					type = type.toString();
					type = type.slice(9, type.indexOf('('));

					if (isArray) {
						type = '[' + type + ']';
					}

					desc.type = type;
				}

				// Normalize the string format for object id fields
				if (desc.type === 'ObjectID') {
					desc.type = 'ObjectId';
				} else if (desc.type === '[ObjectID]') {
					desc.type = '[ObjectId]';
				}

				Object.keys(path.options).forEach(function(opt) {
					if (opt === 'type') {return;}

					desc[opt] = path.options[opt];
					if (desc[opt] === undefined) {
						desc[opt] = null;
					}
				});

				// Make sure that the version number is correctly identified as auto-generated
				if (key === '__v') {
					desc.auto = true;
				}

				// Show only messages for validators
				if (desc.validate) {
					desc.validate = desc.validate.map(function(validation) {
						return validation.msg || validation;
					});
				}
			});

			if (opts.include) {
				Object.keys(opts.include).forEach(function(key) {
					result[key] = opts.include[key];
				});
			}

			return result;
		};
	}

	// 
	// Add the find by query method, but only if one was not already defined
	// 
	// @param {qs} the parsed querystring data for the request
	// @param {modify} a modifier function to mutate the constructed query before running
	// @return promise
	// 
	if (! schema.statics.findByQuery) {
		schema.statics.findByQuery = function(qs, modify) {
			var query = queries.buildQuery(model, {
				offset: qs.offset || 0,
				limit: qs.limit || 10,
				fields: qs.fields,
				populate: (qs.populate && qs.populate.split(',')),
				filter: qs.filter,
				sort: qs.sort
			});

			if (modify) {
				modify(query);
			}

			return query.exec();
		};
	}

	// 
	// Add the serialize method, but only if one was not already defined
	// 
	// @param {obj} the mongoose object to serialize
	// @return object
	// 
	if (! schema.statics.serialize) {
		schema.statics.serialize = function(obj) {
			if (obj.toObject) {
				obj = obj.toObject();
			}
			return obj;
		};
	}

// -------------------------------------------------------------

	// 
	// Returns a method for creating basic crud functions for this model
	// 
	// @param {crudMethod} the crud method ("create", "read", "update", or "destroy")
	// @param {opts} options for things such as idKeys, and update methods
	// @return function
	// 
	if (! schema.statics.crud) {
		schema.statics.crud = function(crudMethod, opts) {
			opts = opts || { };
			switch (crudMethod) {
				case 'create':
					return crudCreate(opts.preCreate);
				case 'read':
					return opts.idKey ? crudReadDetail(opts.idKey) : crudReadList;
				case 'update':
					return crudUpdate(opts);
				case 'delete':
					return opts.idKey ? crudDeleteDetail(opts.idKey) : crudDeleteList;
			}
		};
	}

	// 
	// The crud read method for list endpoints, looks up and returns
	// a list of documents for the model based on the given query
	// 
	// @param {req} the request object
	// @return void
	// 
	function crudReadList(req) {
		var page = 0;
		var docs = [ ];
		var start = req.query.offset || 0;
		var pageSize = req.query.limit || 10;

		Promise
			// Keep fetching docs until we have the amount requested
			.while(needDocs)
			.do(findChunk)
			.then(function() {
				docs = docs.slice(0, pageSize);

				var meta = {
					limit: req.query.limit || 10,
					offset: req.query.offset || 0,
					count: docs.length
				};

				req.send(200, meta, docs.map(model.serialize));
			})
			.catch(
				HttpError.catch(req)
			);

		function needDocs() {
			return docs.length < pageSize;
		}

		function findChunk(_break) {
			return model.findByQuery(req.query, paginate)
				.then(function(objs) {
					// If there are no more matches, stop querying
					if (! objs || ! objs.length) {
						return _break();
					}

					// Check for authorization on each document
					return auth.readList(objs, req);
				})
				.then(function(authed) {
					// Add only authorized docs to the list of results
					docs.push.apply(docs, authed);
				});
		}

		function paginate(query) {
			query.skip(start + (pageSize * page++));
		}
	}

	// 
	// The crud read method for detail endpoints, looks up and returns
	// a single document for the model
	// 
	// @param {idKey} the property name where the id can be found
	// @return function
	// 
	function crudReadDetail(idKey) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			var doc;
			var id = req.params[idKey];

			// Look up the requested document
			model.findById(id)
				.lean()
				.exec()
				.then(function(obj) {
					// Make sure we found something
					if (! obj) {
						throw new HttpError(404, 'Document not found');
					}

					doc = obj;

					// Authorize the user to take this action
					return auth.readDetail(doc, req);
				})
				.then(function(authorized) {
					// If the user is not authorized, send back a 401
					if (! authorized) {
						throw new HttpError(401, 'Not authorized');
					}

					req.send(200, model.serialize(doc));
				})
				.catch(
					HttpError.catch(req)
				);
		};
	}

	// 
	// The crud create method, creates a new document for the model
	// 
	// @param {preCreate} a pre-creation validator/constructor function
	// @return function
	// 
	function crudCreate(preCreate) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			preCreate = preCreate || function(obj) {
				return obj;
			};

			auth.createDetail(req.body)
				.then(function(authorized) {
					if (! authorized) {
						throw new HttpError(401, 'Not authorized');
					}

					return preCreate(req.body, req);
				})
				.then(model.create.bind(model))
				.then(function(doc) {
					req.send(201, model.serialize(doc));
				})
				.catch(
					HttpError.catch(req)
				);
		};
	}

	// 
	// Chooses the appropriate update method for a crud update call
	// 
	// @param {opts} an opts object with idKey (optional) and method
	// @return function
	// 
	function crudUpdate(opts) {
		opts.method = opts.method || 'patch';

		if (opts.method === 'replace') {
			return opts.idKey ? crudUpdateDetailReplace(opts.idKey) : crudUpdateListReplace;
		}

		else if (opts.method === 'patch') {
			return opts.idKey ? crudUpdateDetailPatch(opts.idKey) : crudUpdateListPatch;
		}

		else {
			throw new Error('Invalid value for update method; Must be "replace" or "patch".');
		}
	}

	// 
	// Crud update method, replaces the given documents in the database completely
	// with the given versions; a PUT operation
	// 
	// @param {req} the request object
	// @return void
	// 
	function crudUpdateListReplace(req) {
		// 
	}

	// 
	// Crud update method, replace the given document in the database completely
	// with the given version; a PUT operation
	// 
	// @param {idKey} the property name where the id can be found
	// @return function
	// 
	function crudUpdateDetailReplace(idKey) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			// 
		};
	}

	// 
	// Crud update method, updates the given documents with the attributes in the
	// given versions; a PATCH operation
	// 
	// @param {req} the request object
	// @return void
	// 
	function crudUpdateListPatch(req) {
		// 
	}

	// 
	// Crud update method, updates the given document with the attributes in the
	// given version; a PATCH operation
	// 
	// @param {idKey} the property name where the id can be found
	// @return function
	// 
	function crudUpdateDetailPatch(idKey) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			// 
		};
	}

	// 
	// The crud delete list method, deletes the given documents from the database
	// 
	// @param {req} the request object
	// @return void
	// 
	function crudDeleteList(req) {
		// 
	}

	// 
	// The crud delete detail method, deletes the given document from the database
	// 
	// @param {idKey} the property name where the id can be found
	// @return function
	// 
	function crudDeleteDetail(idKey) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			// 
		};
	}

// -------------------------------------------------------------

	// Make sure we have the model encapsulated here so it can be referenced in these methods
	var model = mongoose.model(name, schema);
	return model;
};
