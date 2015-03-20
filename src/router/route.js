
var Class        = require('../class');
var RouteParser  = require('route-parser');

var Route = module.exports = Class.extend({
	
	init: function(methods, route, func) {
		this.methods  = methods;
		this.route    = new RouteParser(route);
		this.func     = func;
	},

	match: function(pathname) {
		return this.route.match(pathname);
	}

});
