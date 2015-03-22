
var Class   = require('./class');
var dagger  = require('./index');

var Endpoint = module.exports = Class.extend({

	// 
	// @param {baseUrl} the base url for this endpoint; all other urls will be appended on to this
	// @param {routes} an object containing route definitions
	// 
	init: function(baseUrl, routes) {
		var self = this;

		if (typeof baseUrl === 'object') {
			routes = baseUrl;
			baseUrl = '';
		}

		this.baseUrl = baseUrl;

		// Init any routes already given
		if (routes) {
			Object.keys(routes).forEach(function(key) {
				var route = parseRoute(key);

				self._initRoute(route.methods, route.pathname, routes[key]);
			});
		}
	},

	// 
	// Init a single route for the endpoint
	// 
	// @param {methods} a pipe (|) dilimited list of HTTP methods
	// @param {route} the route pattern
	// @param {func} the handler function
	// @return void
	// 
	_initRoute: function(methods, route, func) {
		var router = dagger.app._router;
		router.push(methods, this.baseUrl + route, func);
	},

	// -------------------------------------------------------------

	// 
	// Add a new route to the endpoint
	// 
	// @param {route} a compound method/url route string
	// @param {func} the handler function
	// @return this
	// 
	on: function(route, func) {
		route = parseRoute(route);
		this._initRoute(route.methods, route.pathname, func);

		return this;
	},

	// 
	// Adds a new GET route to the endpoint
	// 
	// @param {route} the route path
	// @param {func} the handler function
	// @return this
	// 
	get: function(route, func) {
		this._initRoute('get', route, func);

		return this;
	},

	// 
	// Adds a new POST route to the endpoint
	// 
	// @param {route} the route path
	// @param {func} the handler function
	// @return this
	// 
	post: function(route, func) {
		this._initRoute('post', route, func);

		return this;
	},

	// 
	// Adds a new PUT route to the endpoint
	// 
	// @param {route} the route path
	// @param {func} the handler function
	// @return this
	// 
	put: function(route, func) {
		this._initRoute('put', route, func);

		return this;
	},

	// 
	// Adds a new PATCH route to the endpoint
	// 
	// @param {route} the route path
	// @param {func} the handler function
	// @return this
	// 
	patch: function(route, func) {
		this._initRoute('patch', route, func);

		return this;
	},

	// 
	// Adds a new DELETE route to the endpoint
	// 
	// @param {route} the route path
	// @param {func} the handler function
	// @return this
	// 
	delete: function(route, func) {
		this._initRoute('delete', route, func);

		return this;
	}

});

// -------------------------------------------------------------

// 
// 
// 
function parseRoute(route) {
	route = route.split(' ');
				
	return {
		methods: (route.length > 1) ? route[0] : '',
		pathname: (route.length > 1) ? route[1] : route[0]
	};
}
