
var conf       = require('./conf');
var paths      = require('./paths');
var httpMeta   = require('./http-meta');
var AppObject  = require('./app-object');
var socket     = require('./socket-io');
var express    = require('./express');

// 
// Define the endpoint class
// 
var Endpoint = module.exports = AppObject.extend({

	init: function(def) {
		this._super();
		
		this.route = def.route;
		delete def.route;

		this.routes = def;

		// Parse the routes into objects
		this.routes = Object.keys(this.routes).reduce(this.initRoute.bind(this), [ ]);

		// Hook up routes to express/socket.io
		this.routes.forEach(this.bindRoute.bind(this));
	},

	initRoute: function(result, route) {
		var data = route.split(' ');
		var func = this.routes[route];

		result.push({
			methods: data[0].split('|'),
			uri: this.route + (data[1] || ''),
			func: function(req) {
				try {
					return func.apply(this, arguments);
				} catch (err) {
					(new httpMeta.HttpError(err)).send(req);
				}
			}
		});

		return result;
	},

	bindRoute: function(route) {
		if (conf.http.enabled) {
			this.bindRouteToExpress(route);
		}

		if (conf.ws.enabled) {
			this.bindRouteToSocket(route);
		}
	},

	bindRouteToExpress: function(route) {
		route.methods.forEach(function(method) {
			express[method](route.uri, function(req, res, next) {
				var request = express.createRequest(req, res, next);
				
				express.runMiddleware(request, function() {
					route.func(request);
				});
			});
		});
	},

	bindRouteToSocket: function(route) {
		route.methods.forEach(function(method) {
			socket[method](route.uri, route.func);
		});
	}

});
