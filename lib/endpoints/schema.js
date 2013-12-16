
var when       = require('when');
var Endpoint   = require('./base');
var conf       = require('../conf');
var HttpError  = require('../http-meta').HttpError;

// 
// Create a SchemaEndpoint subclass of Endpoint for model default resources
// 
// Has an extra method defined for each CRUD operation which is used internally
// by the HTTP endpoint methods to perform basic REST operations
// 
var SchemaEndpoint = module.exports = Resource.extend({

	init: function(model) {
		this._super({
			model: model,
			route: '/' + model.route + '/schema',
			public: model.public && model.public.detail,
		});
	},

// --------------------------------------------------------
	
	// 
	// Handle GET requests
	// 
	// Outputs a schema definition
	// 
	// Example request:
	//   GET /people/schema
	// 
	get: function(req) {
		req.send(200, this.model.schemaDef());
	}

});
