
var Route      = require('./route');
var Class      = require('../class');
var HttpError  = require('../http/error');
var Promise    = require('promise-es6').Promise;

var Router = module.exports = Class.extend({

	init: function() {
		this.routes = [ ];
	},

	// 
	// Add a new route handler on to the stack
	// 
	// @param {method} a pipe "|" delimited list of http methods
	// @param {route} the uri route pattern
	// @param {func} the handler function
	// @return void
	// 
	push: function(method, route, func) {
		method = method.toLowerCase().split('|');
		this.routes.push(new Route(method, route, func));
	},

	// 
	// Find the correct function to handle the given request
	// 
	// @param {req} the request object
	// @return function
	// 
	find: function(req) {
		for (var i = 0; i < this.routes.length; i++) {
			var route = this.routes[i];

			if (route.methods.indexOf(req.method) >= 0) {
				var params = route.match(req.pathname);
				if (params) {
					req.params = params;
					return route.func;
				}
			}
		}
	},

	// 
	// Returns a middleware function that will pass requests through this router
	// 
	// @return function
	// 
	middleware: function() {
		var self = this;

		return function(req) {
			return new Promise(function(resolve, reject) {
				var func = self.find(req);

				if (! func) {
					return reject(new HttpError(404, 'Endpoint not found'));
				}

				var promise = func(req);
				if (promise) {
					return promise.then(resolve, reject);
				}

				resolve();
			});
		};
	}

});
