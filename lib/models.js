
// 
// This model structure is based heavily on the mongoose-models module
// 
// Author: James Brumond (http://jbrumond.me) <james@jbrumond.me>
// Link: {https://github.com/SportZing/mongoose-models}
// 

var path           = require('path');
var wrench         = require('wrench');
var events         = require('events');
var mongoose       = require('mongoose');
var merge          = require('merge-recursive');
var app            = require('./index').app;

// Patch mongoose-types bug (#17 and #21)
// @link {https://github.com/bnoguchi/mongoose-types/}
var bson = require(__dirname + '/../node_modules/mongoose/node_modules/mongodb/node_modules/bson');
mongoose.mongo.BinaryParser = bson.BinaryParser;
	
var mongooseTypes = require('mongoose-types');

var connection = mongoose.createConnection(app.conf.mongodb.url);

// -------------------------------------------------------------

// Expose mongoose and mongoose's types
exports.mongoose  = mongoose;
exports.types     = mongoose.SchemaTypes;

// -------------------------------------------------------------

// Used to define resources for models (needs to be loaded AFTER exports.types is defined above)
var modelResource = require('./model-resource');

// -------------------------------------------------------------

// Handle automatica virtuals
var virtuals = { };
exports.installVirtuals = function(type, builder) {
	virtuals[type._mmId] = builder;
};

// Load extra types
mongooseTypes.loadTypes(mongoose);

// Find all of the models (This does not load models,
// simply creates a registry with all of the file paths)
var models = exports._cache = { };
var addModel = exports._addModel = function(dir, file) {
	if (file[0] === '.') {return;}
	file = file.split('.');
	if (file.length > 1 && file.pop() === 'js') {
		file = file.join('.');
		file = path.join(dir, file);
		var model = path.basename(file).split('-').join('');
		models[model] = function() {
			return models[model].model;
		};
		models[model].path = file;
		models[model].model = null;
		models[model].schema = new mongoose.Schema();
		models[model].resolve = function(func) {
			circles.once(model, func);
			return models[model].getter;
		};
	}
};
wrench.readdirSyncRecursive(app.PATH.MODELS).forEach(function(file) {
	addModel(app.PATH.MODELS, file);
});

// Load a model
exports.require = function(model) {
	if (! models[model]) {
		throw new Error('The model "' + model + '" could not be found.');
	}
	if (! models[model].model) {
		require(models[model].path);
	}
	return models[model];
};

// Get a reference to the ObjectId type
var oid = mongoose.SchemaTypes.ObjectId;

// Handles circular references
var circles = new events.EventEmitter();

// -------------------------------------------------------------

// Creates a new model
exports.create = function(name, props) {
	props = props || { };
	
	var _virtuals = { };
	var protectedFields = [ ];
	var expose = (props.expose == null) ? true : props.expose;

	// Check for a scheme definition
	if (props.schema) {
		var schemaDescription = merge.recursive({ }, props.schema);
		// Look for circular references
		Object.keys(props.schema).forEach(function(key) {
			var def = props.schema[key];
			if (typeof def === 'object' && def.type === oid) {
				// Shortcut simple circular reference to self
				if (def.ref === '$circular') {
					def.ref = { $circular: name };
				}
				// Handle circular references
				if (typeof def.ref === 'object' && def.ref && def.ref.$circular) {
					var model = def.ref.$circular;
					// First, check if the model is already loaded
					if (models[model] && typeof models[model] === 'object') {
						props.schema[key].ref = models[model].schema;
					}
					// Otherwise, wait and resolve it later
					else {
						circles.once(model, function(model) {
							def.ref = model.schema;
							var update = { };
							update[key] = def;
							props.schema.add(update);
						});
						delete props.schema[key];
					}
				}
			}
			// Handle automatic virtuals for custom types
			var type = def;
			if (typeof def === 'object') {
				type = def.type;
				// Handle protected fields
				if (def.protected) {
					protectedFields.push(key);
					delete def.protected;
				}
			}
			if (typeof type === 'function' && type._mmId) {
				var funcs = virtuals[type._mmId](key);
				Object.keys(funcs).forEach(function(virtual) {
					if (virtual[0] === '.') {
						virtual = key + virtual;
					}
					_virtuals[virtual] = funcs[virtual];
				});
			}
		});
		// Create the schema
		props.schema = new mongoose.Schema(props.schema);
		// Bind automatic virtuals
		Object.keys(_virtuals).forEach(function(virtual) {
			var funcs = _virtuals[virtual];
			props.schema.virtual(virtual)
				.get(funcs.get || function() { })
				.set(funcs.set || function() { });
		})
	}

	// Define any indexes required
	if (props.ensureIndex) {
		if (! Array.isArray(props.ensureIndex)) {
			props.ensureIndex = [props.ensureIndex];
		}

		props.ensureIndex.forEach(function(index) {
			props.schema.ensureIndex(index);
		});
	}
	
	// Check if we are loading the timestamps plugin
	if (props.useTimestamps) {
		props.schema.plugin(mongooseTypes.useTimestamps);
	}
	
	// Bind any instance methods to the schema.methods object
	if (props.methods) {
		Object.keys(props.methods).forEach(function(i) {
			props.schema.methods[i] = props.methods[i];
		});
	}

	// Add the ability for pre/post create hooks
	props.schema.pre('save', function(next) {
		this.wasNew = this.isNew;
		next();
	});

	// Add any hooks defined
	if (props.hooks) {
		Object.keys(props.hooks).forEach(function(hook) {
			var funcs = props.hooks[hook];
			hook = hook.split('::');
			
			if (hook[0] !== 'pre' && hook[0] !== 'post') {
				throw new Error('Schema hooks must be defined as pre::<hook> or post::<hook>');
			}

			if (typeof funcs === 'function') {
				funcs = [funcs];
			}

			funcs.forEach(function(func) {
				// Handle create hooks (as they are not part of mongoose, but are custom)
				if (hook[1] === 'create') {
					return props.schema[hook[0]]('save', function(obj, next) {
						if (this.isNew || this.wasNew) {
							func.call(this, obj, next);
						}
					});
				}

				props.schema[hook[0]](hook[1], func);
			});
		});
	}

// -------------------------------------------------------------
	
	// Instance sanitize method
	props.schema.methods.sanitize = function() {
		return model.sanitize(this.toObject());
	};
	
	// Create the mongoose model
	var model = connection.model(name, props.schema);
	
	// Copy over all other properties as static model properties
	var ignored = ['schema', 'useTimestamps', 'methods', 'expose', 'hooks', 'ensureIndex', 'public'];
	Object.keys(props).forEach(function(i) {
		if (ignored.indexOf(i) < 0) {
			model[i] = props[i];
		}
	});

	// Static sanitize method
	model.sanitize = function(obj) {
		if (typeof obj.toObject === 'function') {
			obj = obj.toObject();
		}

		protectedFields.forEach(function(field) {
			delete obj[field];
		});

		return obj;
	};

// -------------------------------------------------------------
//  Dagger specific code for initializing resource instances

	// 
	// Create the resource that will handle requests for this model
	// 
	if (expose) {
		model.resource = modelResource.createDefaultModelResource(name, model, schemaDescription, props.public);
	}

// -------------------------------------------------------------
	
	// Store the model
	models[name].model = model;
	
	// The model is done being built, allow circular reference to resolve
	circles.emit(name, model);

	return model;
};
