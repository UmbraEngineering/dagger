
var paths     = require('./paths');
var redis     = require('./redis');
var mongoose  = require('./mongoose');

exports.Schema  = mongoose.Schema;
exports.types   = mongoose.Schema.Types;

exports.modelCache = { };

exports.require = function(model) {
	if (! exports.modelCache[model]) {
		var name = model.split('/').join('-');

		var cached = exports.modelCache[model] = {
			schema: require(paths.resolve('MODELS', model))
		};

		Object.defineProperty(cached, 'model', {
			enumerable: true,
			configurable: true,
			// Use a getter here so that the model is only defined the first time it is accessed, as
			// opposed to creating the model when the model's module is loaded
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
exports.create = function(name, schema) {
	// Mark the model as new if it is
	schema.pre('save', function(done) {
		this.wasNew = this.isNew;
		done();
	});

	// List for save events
	schema.post('save', function() {
		if (this.wasNew) {
			// Emit a create event
			redis.emit([name, 'create'].join(':'), this.toObject());
		} else {
			// Emit an update event
			redis.emit([name, 'update', this._id].join(':'), this.toObject());
		}
	});

	// Listen for remove events
	schema.post('remove', function() {
		redis.emit([name, 'remove', this._id].join(':'), this.toObject());
	});

	// Create the subscription method, used for watching the redis bus for
	// push events. This is used for socket.io live pushing
	schema.statics.subscribe = function(event, objectId, callback) {
		if (arguments.length === 1) {
			callback = event;
			event = 'create';
		} else if (arguments.length === 2) {
			callback = objectId;
			objectId = null;
		}

		event = (objectId ? [name, event, objectId] : [name, event]).join(':');

		redis.on(event, callback);
	};

	// Remove a previously set event subscription
	schema.statics.unsubscribe = function(event, objectId, callback) {
		if (arguments.length === 1) {
			callback = event;
			event = 'create';
		} else if (arguments.length === 2) {
			callback = objectId;
			objectId = null;
		}

		event = (objectId ? [name, event, objectId] : [name, event]).join(':');

		redis.off(event, callback);
	};

	// Add the schema description method, but only if one was not already defined
	if (! schema.static.schemaDescription) {
		schema.statics.schemaDescription = function() {
			var result = { };

			Object.keys(schema.paths).forEach(function(key) {
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

				Object.keys(path.options).forEach(function(opt) {
					if (opt === 'type') {return;}

					desc[opt] = path.options[opt];
					if (desc[opt] == null) {
						desc[opt] = (desc[opt] === null) ? 'null' : 'undefined';
					}
					desc[opt] = desc[opt].toString();
				});
			});
		};
	}

	// Add the find by query method, but only if one was not already defined
	if (! schema.statics.findByQuery) {
		schema.statics.findByQuery = function(req) {
			// 
			// TODO
			// 
		};
	}

	// Add the serialize method, but only if one was not already defined
	if (! schema.statics.serialize) {
		schema.statics.serialize = function(obj) {
			if (obj.toObject) {
				obj = obj.toObject();
			}
			return obj;
		}
	}

	return mongoose.model(name, schema);
};

