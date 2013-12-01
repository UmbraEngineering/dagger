
var when           = require('when');
var mongoose       = require('./mongoose');
var AppObject      = require('./app-object');
var mongooseTypes  = require('mongoose-types');
var merge          = require('merge-recursive');
var ObjectId       = mongoose.SchemaTypes.ObjectId;

// 
// Define the Model class
// 
var Model = module.exports = AppObject.extend({

	name: null,

	init: function(data) {
		this._super();

		if (data && data instanceof this.mongooseModel) {
			this.initFromMongoose(data);
		} else {
			this.initFromData(data);
		}

		if (typeof this.initialize === 'function') {
			this.initialize();
		}
	},

	initFromData: function(data) {
		this.mongooseInstance = new this.mongooseModel(data);
	},

	initFromMongoose: function(model) {
		this.mongooseInstance = model;
	}

});

// --------------------------------------------------------

// 
// Expose the schema types hash
// 
Model.Types = mongoose.SchemaTypes;

// --------------------------------------------------------

// 
// The onExtend function is what initializes a model class when it is first
// defined, which includes building the mongoose schema/model and creating
// the resource.
// 
Model.onExtend = function() {
	this.onExtend = Model.onExtend;

	this.name = this.prototype.name;

	Model.initSchemaAndModel.call(this);
	Model.initResource.call(this);
};

// --------------------------------------------------------

// 
// Creates a valid mongoose schema and model
// 
Model.initSchema = function() {
	var schema = this.prototype.schema;

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
		if (def.inherits && def.inherits(Model)) {
			def = schema[key] = {type: ObjectId, ref: def.name};
		}
		if (Array.isArray(def) && def[0] && def[0].inherits && def[0].inherits(Model)) {
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

	// Pass the schema through mongoose
	schema = mongoose.Schema(schema);

	// Put the schema back on the prototype, and also create a static property
	this.schema = this.prototype.schema = schema;

	// Create the mongoose model
	this.mongooseModel = this.prototype.mongooseModel = mongoose.model(this.name, schema);
};

// --------------------------------------------------------

// 
// Creates the new resource
// 
Model.initResource = function() {
	// 
	// TODO
	// 
};
