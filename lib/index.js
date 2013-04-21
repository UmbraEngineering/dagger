
// First things first, load the class framework
global.Class = require('classes').Class;

// Load built-in libraries
var path = require('path');

// Load external libraries
var express   = require('express');
var socketio  = require('socket.io');
var config    = require('node-conf');
var wrench    = require('wrench');

// Directory constants
var CONFIG_DIR = 'config';
var MODELS_DIR = 'models';
var ROUTES_DIR = 'routes';

// This function is called by the program using dagger. It initializes everything
// and gets the app up and running
exports.initialize = function(root) {

	// Load the app config
	config.setRootDir(root);
	config.setConfDir(CONFIG_DIR);
	var conf = config.load(process.env.NODE_ENV);

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
	app.PATH = {
		CONFIG: path.join(root, CONFIG_DIR),
		MODELS: path.join(root, MODELS_DIR),
		ROUTES: path.join(root, ROUTES_DIR)
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

	// Create the express server
	if (conf.restApi.enabled) {
		// ...
	}

// -------------------------------------------------------------

	// Create the Socket.IO server
	if (conf.sockets.enabled) {
		// ...
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
