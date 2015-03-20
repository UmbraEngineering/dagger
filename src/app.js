
var Class       = require('./class');
var Router      = require('./router');
var isThenable  = require('promise-es6/lib/utils').thenable;

var App = module.exports = Class.extend({

	// 
	// @param {config} app configuration
	// @param {options} more complex config, like middleware functions
	// 
	init: function(config, options) {
		this.config = config;
		this.options = options;

		this._router = new Router();
		this.router = this._router.middleware();

		this.middleware = [ ];
	},

	// 
	// Adds a middleware to the stack
	// 
	// @param {middleware} the new middleware function
	// @return void
	// 
	use: function(middleware) {
		this.middleware.push(middleware);
	},

	// 
	// Runs through the middleware stack for a request
	// 
	// @param {req} the request object
	// @return promise
	// 
	run: function(req) {
		return this.middleware.reduce(function(prev, task) {
			if (! prev) {
				return task(req);
			}

			return prev.then(function() {
				return task(req);
			});
		}, null);
	}

});
