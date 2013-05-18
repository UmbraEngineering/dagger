
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

	// Create the root app object
	var app = new ao.AppObject(root);

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
	
	var httpEnabled = (conf.http && conf.http.enabled);
	var httpsEnabled = (conf.https && conf.https.enabled);

	if (httpEnabled || httpsEnabled) {
		app.express = express();
	}

	if (httpEnabled) {
		http.createServer(app.express)
			.listen(conf.http.address, conf.http.port, function() {
				app.log(app.LOG.MESSAGE, 'HTTP server listening at ' + conf.http.address + ':' + conf.http.port);
			});
	}

	if (httpsEnabled) {
		if (conf.ssl && conf.ssl.enabled) {
			var keyFile   = app.path(conf.ssl.keyFile);
			var certFile  = app.path(conf.ssl.certFile);
			var caFile    = conf.ssl.caFile && app.path(conf.ssl.caFile);

			var opts = {
				key: fs.readFileSync(keyFile),
				cert: fs.readFileSync(certFile)
			};

			if (caFile) {
				opts.ca = fs.readFileSync(caFile);
			}

			https.createServer(opts, app.express)
				.listen(conf.https.address, conf.https.port, function() {
					app.log(app.LOG.MESSAGE, 'HTTPS server listening at ' + conf.https.address + ':' + conf.https.port);
				});
		}

		else {
			app.log(app.LOG.WARNING, 'HTTPS is enabled in the config, but SSL is not; No HTTPS server will be created.');
		}
	}

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

		else {
			// ...
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

	// Load the model class
	require('./model').initialize(app);

	// Load the various models
	wrench.readdirSyncRecursive(app.PATH.MODELS).forEach(function(model) {
		model = path.join(app.PATH.MODELS, model);
		require(model);
	});

// -------------------------------------------------------------

	return app;
};
