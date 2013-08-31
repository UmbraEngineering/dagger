
var url           = require('url');
var path          = require('path');
var util          = require('util');
var merge         = require('merge-recursive');
var EventEmitter  = require('events').EventEmitter;
var app           = require('./index').app;

var methods = ['get', 'post', 'patch', 'put', 'del'];

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

	this.get    = null;
	this.post   = null;
	this.patch  = null;
	this.put    = null;
	this.del    = null;

	this.auth   = null;
	this.perms  = null;

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

	// Parse authentication object
	this.initializeAuthentication();

	// Parse permissions object
	this.initializePermissions();

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
// Initialize the state of the authentication object so that it is always available in
// the same format.
// 
Resource.prototype.initializeAuthentication = function() {
	var auth = this.auth;

	if (auth == null) {
		auth = false;
	}

	if (typeof auth === 'boolean') {
		auth = {
			get: auth, post: auth, put: auth, patch: auth, del: auth
		};
	}

	this.auth = auth;
};

// -------------------------------------------------------------

// 
// Initialize the state of the permissions object so that it is always available in the
// same format.
// 
Resource.prototype.initializePermissions = function() {
	var perms = this.perms;

	if (! perms) {
		perms = {
			get: [ ], post: [ ], put: [ ], patch: [ ], del: [ ]
		};
	}

	if (util.isArray(perms)) {
		perms = {
			get:    perms.slice(),
			post:   perms.slice(),
			put:    perms.slice(),
			patch:  perms.slice(),
			del:    perms.slice()
		};
	}

	if (perms.all) {
		methods.forEach(function(method) {
			perms[method].push.apply(perms[method], perms.all);
		});
	}

	this.perms = perms;
};

// -------------------------------------------------------------

Resource.prototype._prepareHttp = function(method) {
	var self = this;

	return function(req, res) {
		var requestObject = app.Request.create(self);
		requestObject.initializeHttp(req, res);
		self[method](requestObject);
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
			self[method](requestObject);
		}
	};
};

// -------------------------------------------------------------

Resource.prototype.createSubresource = function(name, opts) {
	opts.parent = this;
	return app.resource.create(name, opts);
};
