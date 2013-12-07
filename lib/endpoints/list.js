
var when       = require('when');
var Endpoint   = require('./base');
var HttpError  = require('./http-meta').HttpError;

// 
// Create a ListEndpoint subclass of Resource for model default resources
// 
var ListEndpoint = module.exports = Endpoint.extend({

	init: function(model) {
		this._super({
			model: model,
			route: '/' + model.route,
			public: model.public && model.public.list,
		});
	},

// --------------------------------------------------------
	
	// 
	// Handle GET requests
	// 
	// Fetches results based on request params
	// 
	get: function(req) {
		this.findForReq(req).then(
			function(objs) {
				req.send(200, objs);
			},
			function(err) {
				err = new HttpError(500, err);
				err.send(req);
			});
	},

	// 
	// The default lookup routine for list GET requests
	// 
	findForReq: function(req) {
		var model = this.model;

		return this.buildQuery(req.params).exec()
			.then(function(objs) {
				return when.all(
					(objs || [ ]).map(model.authorize.bind(model, req))
				);
			})
			.then(function(objs) {
				return objs.map(model.sanitize);
			});
	},

// --------------------------------------------------------
	
	// 
	// Handle POST requests
	// 
	// Creates a new object in the database with the data in the request body
	// 
	post: function(req) {
		// 
	},

// --------------------------------------------------------

	put: function(req) {
		// 
	},

	patch: function(req) {
		// 
	},

	del: function(req) {
		// 
	},

// --------------------------------------------------------

	find: function() {
		return this.mong.apply(this.mong, arguments);
	},

	findOne: function() {
		// 
	},

	findById: function() {
		// 
	}

});

// --------------------------------------------------------

// 
// Provide some pass-through methods for easy querying
// 
['find', 'findOne', 'findById'].forEach(function(method) {
	ListEndpoint.
})
