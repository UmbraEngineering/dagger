
var when           = require('when');
var mongoose       = require('./mongoose');
var endpoints      = require('./endpoints');
var AppObject      = require('./app-object');
var schemaParser   = require('./schema-parser');
var mongooseTypes  = require('mongoose-types');
var merge          = require('merge-recursive');
var ObjectId       = mongoose.SchemaTypes.ObjectId;

// 
// Define the Model class
// 
var Model = module.exports = AppObject.extend({

	name: null,
	route: null,

	// The actual mongoose model
	model: null,

	// Should default resources be created automatically
	expose: true,

	// Should the endpoints be made public
	public: false,

	// Should HTTP/Socket be allowed for accessing this model
	allowHttp: true,
	allowSocket: true,

	// Load the timestamps plugin
	useTimestamps: false,

	// A list of readonly and protected properties
	readonly: null,
	protected: null,

	// Mongoose conf objects
	hooks: null,
	statics: null,
	method: null,
	options: null,

	// 
	// Init
	// 
	init: function(name, opts) {
		this._super();

		merge(this, opts);
		this.name = name;
		
		this.bind('sanitize', 'removeReadonlyFields', 'authorize');

		this.route = this.route || this.name.toLowerCase() + 's';

		// Keep a copy of the originally given schema
		this.__schema = this.schema;

		// Start initializing...
		this.initSchema();
		this.initModel();

		// Create the default endpoints
		if (this.expose) {
			this.initEndpoints();
		}
	},

	// 
	// Initialize the mongoose schema
	// 
	initSchema: function() {
		var self = this;
		var schema = this.schema;

		if (! schema || typeof schema !== 'object') {
			throw new Error('Models must be defined with a schema');
		}

		// Grab these arrays so we can add to them
		var readonly = this.readonly = [ ];
		var protected = this.protected = [ ];

		// Iterate through the schema
		Object.keys(schema).forEach(function(key) {
			var def = schema[key];

			// Allow shorthand references
			if (def instanceof Model) {
				def = schema[key] = {type: ObjectId, ref: def.name};
			}
			if (Array.isArray(def) && (def[0] instanceof Model)) {
				def[0] = {type: ObjectId, ref: def[0].name};
			}

			if (typeof def === 'object') {
				// Handle references
				if (def.ref && def.ref.inherits && def.ref.inherits(Model)) {
					def.ref = def.ref.name;
				}

				// Handle readonly fields
				if (def.readonly) {
					readonly.push(key);
					delete def.readonly;
				}

				// Handle protected fields
				if (def.protected) {
					protected.push(key);
					delete def.protected;
				}
			}
		});

		// Load the timestamps plugin
		if (this.useTimestamps) {
			schema.plugin(mongooseTypes.useTimestamps);
			delete this.useTimestamps;
		}

		// Pass the schema through mongoose
		schema = new mongoose.Schema(schema, this.options);

		// This helps us make a create hook
		schema.pre('save', function(next) {
			this.wasNew = this.isNew;
			next();
		});

		// Handle hooks
		if (this.hooks) {
			Object.keys(this.hooks, function(key) {
				this.hook(key, this.hooks[key]);
			}.bind(this));
		}

		// Add static methods
		if (this.statics) {
			var statics = this.statics;
			Object.keys(statics).forEach(function(key) {
				schema.statics[key] = statics[key];
				self[key] = function() {
					return self.model.apply(self.model, arguments);
				};
			});
		}

		// Add instance methods
		if (this.methods) {
			merge(schema.methods, this.methods);
		}

		// Put the schema back on the prototype, and also create a static property
		this.schema = schema;
	},

	// 
	// Create and store the mongoose model
	// 
	initModel: function() {
		this.model = mongoose.model(this.name, this.schema);
	},

	// 
	// Initialize the endpoints for this model
	// 
	initEndpoints: function() {
		this.listEndpoint = new endpoints.List(this);

		// We have to initialize the schema endpoint before the detail endpoint
		// that way the "/model/:id" route doesn't catch "/model/schema"
		if (conf.endpoints.schema) {
			this.schemaEndpoint = new endpoints.Schema(this);
		}
		
		this.detailEndpoint = new endpoints.Detail(this);
	},

// --------------------------------------------------------
	
	// 
	// Returns a schema definition object
	// 
	schemaDef: function() {
		return schemaParser.parse(this.__schema);
	},

// --------------------------------------------------------

	// 
	// Adds a hook
	// 
	// Example:
	//   this.hook("before::save", function(next) {
	//     doStuff.then(next);
	//   });
	// 
	hook: function(hook, funcs) {
		hook = hook.split('::');

		var prePost = hook[0];
		var hookName = hook[1];
		var schema = this.schema;

		// Allow "before" to be used in place of "pre"
		if (prePost === 'before') {
			prePost = 'pre';
		}

		// Allow "after" to be used in place of "post"
		if (prePost === 'after') {
			prePost = 'post';
		}

		// Allow binding one or multiple functions at a time
		funcs = Array.isArray(funcs) ? funcs : [funcs];
		funcs.forEach(function(func) {
			var realFunc = func;
			
			// Mongoose does not have a built-in "create" hook, so we add one by
			// listening to the "save" hook and checking for new instances only
			if (hookName === 'create') {
				hookName = 'save';
				func = function(next) {
					if (this.isNew || this.wasNew) {
						return realFunc.apply(this, arguments);
					} else if (typeof next === 'function') {
						next();
					}
				};
			}

			schema[prePost](hookName, func);
		});
	},

// --------------------------------------------------------
	
	// 
	// Create a new model instance with the given data
	// 
	create: function(data) {
		return new this.model(data);
	},

	// 
	// Sanitizes a model instance, removing protected properties. Protected property
	// definitions allow us to mark a property as one that should not be sent to the
	// client in a response. An example would be that you should not send user passwords
	// to a client... ever. So, we can protect it like this:
	// 
	//   schema: {
	//     username: String,
	//     password: {type: String, protected: true}
	//   }
	// 
	sanitize: function(obj) {
		if (obj instanceof this.model) {
			obj = obj.toObject();
		}

		if (obj) {
			// Remove any properties that are listed as protected
			this.protected.forEach(function(prop) {
				delete obj[prop];
			});
		}

		return obj;
	},

	// 
	// Remove properties from the given object that represent readonly fields
	// 
	// Fields that should not be overriden directly by a REST call can be listed
	// as readonly. For example, users shouldn't be able to change there own
	// auth permissions, so you should store your auth data as readonly:
	// 
	//   schema: {
	//     username: String,
	//     auth: {type: Model.Types.ObjectId, ref: 'auth-entity', readonly: true}
	//   }
	// 
	removeReadonlyFields: function(obj) {
		if (obj instanceof this.model) {
			obj = obj.toObject();
		}

		if (obj) {
			this.readonly.forEach(function(prop) {
				delete obj[prop];
			});
		}

		return obj;
	},

	// 
	// Determine if the user connected to {req} has permission to perform the requested
	// action on {obj}. Returns a promise. This promise should almost always be resolved,
	// rejection should only be used in this function for the most fatal of errors.
	// 
	// Resolves with a Boolean representing whether or not the request is authorized. An
	// optional second parameter can be given to
	// 
	authorize: function(req, obj) {
		// 
		// TODO
		// 
		return when.resolve(true);
	}

});

// --------------------------------------------------------

// 
// Expose the schema types
// 
Model.Types = mongoose.SchemaTypes;
