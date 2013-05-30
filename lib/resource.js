
var path          = require('path');
var util          = require('util');
var EventEmitter  = require('events').EventEmitter;

exports.initialize = function(app) {

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
	Class('Resource').Extends('AppObject', {

		name: null,
		route: null,
		parent: null,

		allowHttp: true,
		allowSocket: true,

		get: null,
		post: null,
		patch: null,
		put: null,
		del: null,

		auth: null,
		perms: null,

		construct: function(name, opts) {
			this.construct.parent(this);

			this.name = name;

			// Store a reference to this resource
			resourceTypes[name] = this;

			// Load in the given options
			_.extend(this, opts);

			// Bind the initialize method
			this.initialize = _.bind(this.initialize, this);

			// If a parent resource was given, we have to wait for it to exist
			if (this.parent) {
				resourceQueue.on('ready_' + this.parent, this.initialize);
			}
			
			// If there is not a parent resource, we can initialize immediately
			else {
				this.initialize();
			}
		},

		initialize: function() {
			var self = this;

			// If a parent resource was given, look it up and update the route string
			if (self.parent) {
				if (typeof self.parent === 'string') {
					self.parent = resourceTypes[self.parent];
				}

				self.route = self.parent.route.path + self.route;
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
			resourceQueue.emit('ready_' + name);
		},

		// 
		// Initialize the state of the authentication object so that it is always available in
		// the same format.
		// 
		initializeAuthentication: function() {
			var auth = this.auth;

			if (auth == null) {
				auth = false;
			}

			if (typeof auth === 'boolean') {
				auth = {
					get: auth, post: auth, put: auth, patch: auth, del: auth;
				}
			}

			this.auth = auth;
		},

		// 
		// Initialize the state of the permissions object so that it is always available in the
		// same format.
		// 
		initializePermissions: function() {
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
		},

	// -------------------------------------------------------------

		_prepareHttp: function(method) {
			var self = this;

			return function(req, res) {
				self[method](
					app.Request.create(self).initializeHttp(req, res)
				);
			}
		},

		_prepareSocket: function(method, connection) {
			var self = this;

			return function(req, res) {
				if (self.route.match(req.url)) {
					self[method](
						app.Request.create(self).initializeSocket(socket, req, self.route.params, res)
					);
				}
			}
		}

	});

};
