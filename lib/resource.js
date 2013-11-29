
var conf       = require('./conf');
var express    = require('./express');
var AppObject  = require('./app-object');
var merge      = require('merge-recursive');

// Load the route class from express
var ExpressRoute = require(
	path.join(app.PATH.MODULES.EXPRESS, 'lib/router/route')
);

// 
// Define the Resource class
// 
var Resource = module.exports = AppObject.extend({

	route: null,

	allowHttp: true,
	allowSocket: true,

	get: null,
	post: null,
	put: null,
	patch: null,
	del: null,

	init: function(opts) {
		merge(this, opts);

		if (this.allowHttp && (conf.http.enabled || conf.https.enabled)) {
			this.bind(this.onHttp);
			this.initHttp();
		}

		if (this.allowSocket && conf.socket.enabled) {
			this.bind(this.onSocket);
			this.initSocket();
		}
	},

// --------------------------------------------------------
	
	// 
	// Prepare for HTTP request handling
	// 
	initHttp: function() {
		var route = this.route;
		var onHttp = this.onHttp;
		['get', 'post', 'put', 'patch', 'del'].forEach(function(method) {
			express[method](route, onHttp);
		});
	},

	// 
	// Runs when an HTTP request comes in
	// 
	onHttp: function(req, res, next) {
		// If this resource is domain bound, make sure we are on the
		// correct domain
		if (this.domain && (this.domain !== req.headers.host)) {
			return next();
		}

		// Create the standardized dagger request object
		var Request = new Request();
		Request.initHttp(req, res, next);

		// 
	},

// --------------------------------------------------------
	
	// 
	// Prepares for Socket request handling
	// 
	initSocket: function() {
		var onSocket = this.onSocket;
		this._route = new ExpressRoute('', this.route, [ ], {strict: false, sensitive: false});
		socketio.sockets.on('connection', function(socket) {
			['get', 'post', 'put', 'patch', 'del'].forEach(function(method) {
				socket.on(method, onSocket);
			});
		});
	},

	// 
	// Runs when a Socket request comes in
	// 
	onSocket: function(payload, callback) {
		// 
	}

// --------------------------------------------------------

});

Resource.create = function(opts) {
	return new Resource(opts);
};
