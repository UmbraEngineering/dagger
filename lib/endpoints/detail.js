
var Resource = require('./resource');

// 
// Create a DetailEndpoint subclass of Resource for model default resources
// 
var DetailEndpoint = module.exports = Resource.extend({

	init: function(model) {
		this._super({
			model: model,
			route: '/' + model.route + '/:id',
			public: model.public && model.public.detail,
		});
	},

	get: function(req) {
		// 
	},

	post: function(req) {
		// 
	},

	put: function(req) {
		// 
	},

	patch: function(req) {
		// 
	},

	del: function(req) {
		// 
	}

});
