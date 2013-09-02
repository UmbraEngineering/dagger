
var url           = require('url');
var path          = require('path');
var oath          = require('oath');
var merge         = require('merge-recursive');
var EventEmitter  = require('events').EventEmitter;
var app           = require('./index').app;

var methods = ['get', 'head', 'post', 'patch', 'put', 'del', 'options'];
var verbs = {
	get:     'read',
	head:    'read',
	post:    'create',
	patch:   'update',
	put:     'update',
	delete:  'delete'
}

// Load the route class from express
var Route = require(
	path.join(app.PATH.MODULES.EXPRESS, 'lib/router/route')
);

// Store a cache of the resources created
var resourceTypes = { };
var resourceQueue = new EventEmitter();

// 
// The resource class used for handling all resource routing
// 
var Resource = exports.Resource = function(name, opts) {
	this.name      = name;
	this.route     = null;
	this.parent    = null;
	this.children  = { };

	this.allowHttp    = true;
	this.allowSocket  = true;

	// There is also a HEAD and OPTIONS endpoint for resources, but they are handled automatically
	this.get    = null;
	this.post   = null;
	this.patch  = null;
	this.put    = null;
	this.del    = null;

	this.public  = false;

	// Store a reference to this resource
	resourceTypes[name] = this;

	// Load in the given options
	merge(this, opts);

	// Bind the initialize method
	this.initialize = this.initialize.bind(this);

	// If a parent resource was given, we have to wait for it to exist
	if (typeof this.parent === 'string' && ! resourceTypes[this.parent]) {
		resourceQueue.on('ready_' + parentName, this.initialize);
	}
	
	// If there is not a parent resource, we can initialize immediately
	else {
		this.initialize();
	}
};

// -------------------------------------------------------------

Resource.create = function(name, opts) {
	return new Resource(name, opts);
};

// -------------------------------------------------------------

Resource.HttpError = require('./http-error');

// -------------------------------------------------------------

Resource.prototype.initialize = function() {
	var self = this;

	// If a parent resource was given, look it up and update the route string
	if (self.parent) {
		if (typeof self.parent === 'string') {
			self.parent = resourceTypes[self.parent];
		}

		self.route = self.parent.route.path + self.route;

		// Add this resource to the parent resource's children list
		self.parent.children[self.name] = self;
	}

	// If self resource allows HTTP, create the express routes
	if (app.express && self.allowHttp) {
		methods.forEach(function(method) {
			if (self[method]) {
				app.express[method](self.route, self._prepareHttp(method));
			}
		});
	}

	// If self resource allows socket requests, create the necessary listeners
	if (app.socketio && self.allowSocket) {
		// Create the route object (we borrow the route constructor from express)
		self.route = new Route('', self.route, [ ], {strict: false, sensitive: false});

		// This runs whenever a socket connection is made
		app.socketio.sockets.on('connection', function(socket) {
			// Start listening for requests
			methods.forEach(function(method) {
				socket.on(method, self._prepareSocket(method, socket));
			});
		});
	}

	// Emit an event when the resource is ready
	resourceQueue.emit('ready_' + this.name);
};

// -------------------------------------------------------------

// 
// Checks if the given request has valid credentials to finish running.
// 
Resource.prototype.authorize = function(req) {
	// If auth isn't enabled, always authorize every request
	if (! app.conf.auth.enabled) {
		return true;
	}

	// If the resource is public, always authorize every request
	if (this.public) {
		var public = this.public;

		if (typeof public === 'object') {
			public = public[req.method];
		}
		
		if (public) {
			return true;
		}
	}

	// At this point, you at least need some form of authentication to move forward
	if (! req.auth) {
		return 401;
	}

	// Allow anyone who is authenticated to make options requests to any resource
	if (req.method === 'options') {
		return true;
	}

	// Get the correct action for this method
	var verb = verbs[req.method];

	// If there is no verb, this is not a valid method
	if (! verb) {
		return 405;
	}

	// Check for permission to make the request
	if (req.auth.hasPermission(this.name + '.' + verb, req)) {
		return true;
	}

	return 403;
};

// -------------------------------------------------------------

Resource.prototype._prepareHttp = function(method) {
	var self = this;

	return function(req, res) {
		var requestObject = app.Request.create(self);
		requestObject.initializeHttp(req, res);
	};
};

// -------------------------------------------------------------

Resource.prototype._prepareSocket = function(method, connection) {
	var self = this;

	return function(req, res) {
		var parsed = url.parse(req.url, true);
		if (self.route.match(parsed.pathname)) {
			var requestObject = app.Request.create(self);
			requestObject.initializeSocket(socket, req, self.route.params, parsed.query, res);
		}
	};
};

// -------------------------------------------------------------

Resource.prototype.allow = function() {
	var self = this;
	var allow = [ ];
	
	methods.forEach(function(method) {
		if (self[method]) {
			method = method === 'del' ? 'delete' : method;
			allow.push(method);
		}
	});

	return allow;
};

// -------------------------------------------------------------

Resource.prototype.head = function(req) {
	// app.Request forces HEAD requests to have no response body, so we can just run
	// an actual GET request and it will be responded to correctly
	return this.get(req);
};

// -------------------------------------------------------------

Resource.prototype.options = function(req) {
	var supportedMethods = this.allow().join(', ');

	req.setHeader('Allow', supportedMethods);
	req.setHeader('Access-Control-Allow-Methods', supportedMethods);

	req.send(200);
};

// -------------------------------------------------------------

Resource.prototype.createSubresource = function(name, opts) {
	opts.parent = this;
	return app.resource.create(name, opts);
};
