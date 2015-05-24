
var Class         = require('./class');
var paths         = require('./paths');
var Router        = require('./router');
var conf          = require('./config');
var HttpServer    = require('./server/http');
var SocketServer  = require('./server/socket');
var requireDir    = require('require-dir');

var App = module.exports = Class.extend({

	// 
	// @param {options} more complex config, like middleware functions
	// 
	init: function(options) {
		this.options = options || { };

		// Create the router
		this._router = new Router();
		this.router = this._router.middleware();

		// This array holds the middleware stack that is called for every request
		this.middleware = [ ];
	},

	setup: function() {
		var self = this;

		// Call any bootstrappers
		if (this.options.bootstrap) {
			if (! Array.isArray(this.options.bootstrap)) {
				this.options.bootstrap = [ this.options.bootstrap ];
			}
			this.options.bootstrap.forEach(function(func) {
				func.call(self);
			});
		}

		// Call the function that defines the app middlewares
		if (this.options.middleware) {
			this.options.middleware.call(this);
		}

		// Default to just using the router middleware
		else {
			this.use(this.router);
		}

		// Start up the HTTP(S) server
		this.httpServer = new HttpServer();
		this.httpServer.createServer();

		// Start up socket.io
		if (conf.ws && conf.ws.enabled) {
			this.socketServer = new SocketServer();
			this.socketServer.createServer(this.httpServer.server);
		}

		// Load in the endpoints
		this.loadEndpoints();

		// Call any postInits
		if (this.options.postInit) {
			if (! Array.isArray(this.options.postInit)) {
				this.options.postInit = [ this.options.postInit ];
			}
			this.options.postInit.forEach(function(func) {
				func.call(self);
			});
		}
	},

	// 
	// Adds a middleware to the stack
	// 
	// @param {middleware} the new middleware function
	// @return void
	// 
	use: function(middleware) {
		this.middleware.push(middleware);
	},

	// 
	// Runs through the middleware stack for a request
	// 
	// @param {req} the request object
	// @return promise
	// 
	run: function(req) {
		return this.middleware.reduce(function(prev, task) {
			if (! prev) {
				return task(req);
			}

			return prev.then(function() {
				return task(req);
			});
		}, null);
	},

	// 
	// Loads endpoints into the server
	// 
	// @return void
	// 
	loadEndpoints: function() {
		requireDir(paths.endpoints, {recurive: true});
	}

});
