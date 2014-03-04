
var url        = require('url');
var conf       = require('./conf');
var AppObject  = require('./app-object');
var httpMeta   = require('./http-meta');
var merge      = require('merge-recursive');
var app        = require('./index').app;

// Borrow the route class from express for parsing urls for
// socket.io requests in a compatable way
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

	public: false,

	init: function(opts) {
		merge(this, opts);

		this.normalizePublic();

		if (this.allowHttp && (conf.http.enabled || conf.https.enabled)) {
			this.bind('onHttp');
			this.initHttp();
		}

		if (this.allowSocket && conf.socket.enabled) {
			this.bind('onSocket');
			this.initSocket();
		}
	},

	// 
	// Allow defining public methods in a few different ways, but convert all
	// of them to a standardized hash
	// 
	normalizePublic: function() {
		// Allow global `public: true` type definitions
		if (typeof this.public === 'boolean') {
			this.public = httpMeta.methodFuncs.reduce(reduceToHash(this.public));
		}

		// Allow arrays like `["get", "-post", "+put"]`
		if (Array.isArray(this.public)) {
			this.public = this.public.reduce(reduceToHash());
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
			app.express.listen(method, route, onHttp);
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
		var route = this.route;
		var onSocket = this.onSocket;
		httpMeta.methodFuncs.forEach(function(method) {
			app.socketio.listen(method, route, onSocket);
		});
	},

	// 
	// Runs when a Socket request comes in
	// 
	onSocket: function(socket, payload, callback) {
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

		// Authenticate
		var public = this.public;
		req.authenticate().then(
			function(auth) {
				// If there is no authenticated user, check if the requested
				// resource/method is listed as public
				if (! auth && ! public[req.methodFunc]) {
					return (new HttpError(401, 'Not authenticated')).send(req);
				}
			},

			// Send any errors to the client
			function(err) {
				(new HttpError(500, err)).send(req);
			});

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

// --------------------------------------------------------

// 
// Returns a callback to use in a reduce call. Turns an array of strings into
// an object containing boolean properties. For example:
// 
//   ['a', 'b', 'c'].reduce(reduceToHash(true))
// 
// Results in an object:
// 
//   {a: true, b: true, c: true}
// 
// If a value parameter is not given, it will default to {true}, BUT it will also
// look for indicators in the property names to use a different value:
// 
//   ['foo', '-bar', '+baz'].reduce(reduceToHash())
// 
// Results in this object:
// 
//   {foo: true, bar: false, baz: true}
// 
function reduceToHash(value) {
	var obj = { };
	var plusMinus = (arguments.length === 0);
	return function(memo, prop) {
		if (plusMinus) {
			switch (prop[0]) {
				case '-':
					value = false;
					prop = prop.slice(1);
				break;
				case '+':
					value = true;
					prop = prop.slice(1);
				break;
				default:
					value = true;
				break;
			}
		}
		obj[prop] = value;
		return obj;
	};
}
