
// First things first, load the class framework
global.Class = require('classes').Class;

// Load built-in libraries
var fs     = require('fs');
var path   = require('path');
var http   = require('http');
var https  = require('https');

// Load external libraries
var express   = require('express');
var socketio  = require('socket.io');
var config    = require('node-conf');
var wrench    = require('wrench');

// Directory constants
var CONFIG_DIR     = 'config';
var MODELS_DIR     = 'models';
var ROUTES_DIR     = 'routes';
var TEMPLATES_DIR  = 'templates';

// This function is called by the program using dagger. It initializes everything
// and gets the app up and running
exports.initialize = function(root, opts) {

	// Load the app config
	config.setRootDir(root);
	config.setConfDir(CONFIG_DIR);
	var conf = config.load(process.env.NODE_ENV);

	// Opts isn't use for much at the moment, just to allow passing in an existing
	// socket.io server.
	opts = opts || { };

// -------------------------------------------------------------

	// Load the AppObject class
	var ao = require('./app-object').initialize(conf);

	// Create the root app object and expose it
	var app = exports.app = new ao.AppObject(root);

	// Expose the AppObject class
	app.AppObject = ao.AppObject;

	// Expose logging utilities
	app.LOG = ao.LOG;
	app.log = ao.log;

	// Expose config
	app.conf = conf;

	// Path constants
	var MODULES = path.join(_dirname, '../node_modules');
	app.PATH = {
		ROOT:       root,
		CONFIG:     path.join(root, CONFIG_DIR),
		MODELS:     path.join(root, MODELS_DIR),
		ROUTES:     path.join(root, ROUTES_DIR),
		TEMPLATES:  path.join(root, TEMPLATES_DIR),
		DAGGER:     path.join(_dirname, '..')
		MODULES: {
			EXPRESS:   path.join(MODULES, 'express'),
			SOCKETIO:  path.join(MODULES, 'socket.io')
		}
	};

	// Path resolving utility
	app.path = function(from, to) {
		if (arguments.length < 2) {
			to = from, from = 'ROOT';
		}

		from = app.PATH[from];
		return path.resolve(from, to);
	};

// -------------------------------------------------------------

	// Create the redis bus if needed
	if (conf.instances.enabled) {
		if (! conf.instances.redis) {
			app.log(app.LOG.CRITICAL, 'Cannot enable multi-instance mode without redis pub/sub configuration');
		}

		require('./redis-bus').initialize(app);
		app.redisBus = new app.RedisBus(conf.instances.redis);
	}

// -------------------------------------------------------------
	
	// Load and prepare SSL configuration if needed
	if (conf.https && conf.https.enabled) {
		var keyFile   = app.path(conf.https.keyFile);
		var certFile  = app.path(conf.https.certFile);
		var caFile    = conf.https.caFile && app.path(conf.https.caFile);

		var httpsOpts = {
			key: fs.readFileSync(keyFile),
			cert: fs.readFileSync(certFile)
		};

		if (caFile) {
			httpsOpts.ca = fs.readFileSync(caFile);
		}
	}

// -------------------------------------------------------------

	if (conf.restApi.enabled) {
		app.express = express();
	}

	// 
	// Define the handler function for the servers. If the REST API is enabled, this function will
	// be express. If there is no REST API, but the sockets configuration defines a landing page, that
	// page will be served for all incomming requests. Otherwise, a simple 500 error will be sent back
	// to all incomming requests.
	// 
	var landingPage = conf.sockets && conf.sockets.enabled && conf.sockets.landingPage;
	var handler = app.express || (typeof landingPage === 'function' && landingPage) || function(req, res) {
		if (landingPage) {
			// 
		} else {
			res.writeHead(500, {'Content-Type': 'text/plain'});
			res.end('This server is not configured for basic HTTP(S) communication');
		}
	};

	// Start up the HTTP server
	if (conf.http && conf.http.enabled) {
		app._http = http.createServer(handler)
			.listen(conf.http.address, conf.http.port, function() {
				app.log(app.LOG.MESSAGE, 'HTTP server listening at ' + conf.http.address + ':' + conf.http.port);
			});
	}

	// Start up the HTTPS server
	if (conf.https && conf.https.enabled) {
		app._https = https.createServer(httpsOpts, handler)
			.listen(conf.https.address, conf.https.port, function() {
				app.log(app.LOG.MESSAGE, 'HTTPS server listening at ' + conf.https.address + ':' + conf.https.port);
			});
	}

	// Configure express if it is being used (REST API enabled)
	if (app.express) {
		require('./config-express').initialize(app);
	}

// -------------------------------------------------------------

	// Create the Socket.IO server
	if (conf.sockets.enabled) {
		
		// If an existing socket.io server was given, use that instead of creating a new one
		if (opts.socketio) {
			app.socketio = opts.socketio;
			app.log(app.LOG.MESSAGE, 'Listening to given pre-existing socket.io server');
		}

		// 
		// TODO:
		// 
		//   I need to find a way to make socket.io able to listen to *both* HTTP and HTTPS. There
		//   is currently no way to make socket.io listen to two servers with one instance, but there
		//   is an open issue (https://github.com/LearnBoost/socket.io/pull/1099). If a patch is put
		//   into socket.io, I can use that new feature. If not, I will have to make my own hack to
		//   work around socket.io's shortcomming.
		// 
		else {
			if (app._http) {
				app.socketio = socketio.listen(app._http);
			}
			
			if (app._https) {
				app.socketio = socketio.listen(app._https);
			}
		}

	}

// -------------------------------------------------------------
	
	// Make sure their is at least one exposed API
	if (! (app.express || app.socketio)) {
		app.log(app.LOG.CRITICAL, 'Cannot run server without at least exposed API (REST or Socket.IO)');
	}

// -------------------------------------------------------------
	
	// Load the resource class
	require('./resource').initialize(app);

// -------------------------------------------------------------

	// Load the model library
	app.models = require('./models');
	app.models.initialize(app);

	// Load the various models
	wrench.readdirSyncRecursive(app.PATH.MODELS).forEach(function(model) {
		model = path.join(app.PATH.MODELS, model);
		require(model);
	});

// -------------------------------------------------------------

	return app;
};
