
var Class        = require('../class');
var RouteParser  = require('route-parser');

var Route = module.exports = Class.extend({
	
	// 
	// @param {methods} an array of HTTP methods to handle
	// @param {route} the uri pattern string
	// @param {func} the handler function
	// 
	init: function(methods, route, func) {
		this.methods  = methods;
		this.route    = new RouteParser(route);
		this.func     = func;
	},

	// 
	// Test if a given path name matches the route
	// 
	// @param {pathname} the path to test
	// @return boolean
	// 
	match: function(pathname) {
		return this.route.match(pathname);
	}

});
