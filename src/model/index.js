
var dagger     = require('../index');
var paths      = require('../paths');
var conf       = require('../config');
var mongoose   = require('./mongoose');
var HttpError  = require('../http/error');

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
					value: exports.create(name, cached.schema)
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
// @return object
// 
exports.create = function(name, schema) {
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
						type = '[' + type + ']'
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
	// 
	// 
	if (! schema.statics.crud) {
		schema.statics.crud = function(crudMethod, idKey) {
			switch (crudMethod) {
				case 'create':
					return crudCreate;
				case 'read':
					return idKey ? crudReadDetail(idKey) : crudReadList;
				case 'update':
					return idKey ? crudUpdateDetail(idKey) : crudUpdateList;
				case 'delete':
					return idKey ? crudDeleteDetail(idKey) : crudDeleteList;
			}
		};
	}

	// 
	// 
	// 
	function crudReadList(req) {
		// 
	}

	// 
	// 
	// 
	function crudReadDetail(idKey) {
		return function(req) {
			var id = req.params[idKey];

			model.findById(id).exec()
				.then(function() {
					// 
				})
				.catch(
					HttpError.catch(req)
				);
		};
	}

	// 
	// 
	// 
	function crudCreate(req) {
		// 
	}

	// 
	// 
	// 
	function crudUpdateList(req) {
		// 
	}

	// 
	// 
	// 
	function crudUpdateDetail(idKey) {
		return function(req) {
			// 
		};
	}

	// 
	// 
	// 
	function crudDeleteList(req) {
		// 
	}

	// 
	// 
	// 
	function crudDeleteDetail(idKey) {
		return function(req) {
			// 
		};
	}

// -------------------------------------------------------------

	// Make sure we have the model encapsulated here so it can be referenced in these methods
	var model = mongoose.model(name, schema);
	return model;
};
