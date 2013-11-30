
var conf       = require('./conf');
var express    = require('./express');
var AppObject  = require('./app-object');
var httpMeta   = require('./http-meta');
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
		httpMeta.methodFuncs.forEach(function(method) {
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

		// Create the standardized request object
		var request = new Request();
		request.initHttp(req, res, next);

		// Handle the request...
		this.handleRequest(request);
	},

// --------------------------------------------------------
	
	// 
	// Prepares for Socket request handling
	// 
	initSocket: function() {
		var onSocket = this.onSocket;
		this._route = new ExpressRoute('', this.route, [ ], {strict: false, sensitive: false});
		socketio.sockets.on('connection', function(socket) {
			httpMeta.methodFuncs.forEach(function(method) {
				socket.on(method, onSocket);
			});
		});
	},

	// 
	// Runs when a Socket request comes in
	// 
	onSocket: function(payload, callback) {
		// Check that the request matches the route
		var parsed = url.parse(payload.url, true);
		if (! this._route.match(parsed.pathname)) {
			return;
		}

		// Create the standardized request object
		var request = new Request();
		request.initSocket(socket, payload, this._route.params, parsed.query, callback);

		// Handle the request...
		this.handleRequest(request);
	},

// --------------------------------------------------------
	
	// 
	// Given a standardized request object, process the request
	// 
	handleRequest: function(req) {
		var func = req.method.toLowerCase();
		
		// We call DELETE "del" to avoid using the JavaScript keyword "delete"
		if (func === 'delete') {
			func = 'del';
		}

		// Make sure the request is for a supported method
		if (httpMeta.methodFuncs.indexOf(func) < 0) {
			return req.send(501);
		}
		
		// Check if a function was defined for this method
		if (! this[func]) {
			return req.send(405);
		}

		// Call the function
		this[func](req);
	},

// --------------------------------------------------------
	
	// 
	// Returns an array of methods Allowed by this resource
	// 
	allow: function() {
		var self = this;
		var allow = [ ];
		
		httpMeta.methodFuncs.forEach(function(method) {
			if (self[method]) {
				method = (method === 'del') ? 'delete' : method;
				allow.push(method);
			}
		});

		return allow;
	},

// --------------------------------------------------------
	
	// 
	// Run HEAD requests as GET requests; The Request class with ensure that
	// no response body is sent
	// 
	head: function(req) {
		this.get(req);
	},

	// 
	// Respond to OPTIONS requests with some basic Headers
	// 
	options: function(req) {
		var supportedMethods = this.allow().join(', ');

		req.setHeader('Allow', supportedMethods);
		req.setHeader('Access-Control-Allow-Methods', supportedMethods);

		req.send(200);
	}

});

// --------------------------------------------------------

// 
// Create a new Resource instance
// 
Resource.create = function(opts) {
	return new Resource(opts);
};
