
var path    = require('path');
var wrench  = require('wrench');
var PATH    = require('./paths');
var conf    = require('./conf');

// 
// Allows loading of dagger's internal modules
// 
exports.require = function(file) {
	return require('./' + file);
};

// 
// Start a dagger server
// 
exports.start = function() {
	if (exports.app) {return;}

	// Create a new app object
	var app = exports.app = { };

	// Define a method for resolving paths easily
	app.path = function(from, to) {
		if (arguments.length < 2) {
			to = from, from = 'ROOT';
		}

		return path.resolve(PATH[from], to);
	};

	// Create an express server if needed
	if (conf.rest.enabled) {
		app.express = exports.createServer('express');
	}

	// Create a socket.io server if needed
	if (conf.socket.enabled) {
		app.socketio = exports.createServer('socketio');
	}

	// Load in app files
	exports.loadResources();
	exports.loadModels();
};

// 
// Create a new server instance
// 
exports.createServer = function(type) {
	var Server = require('./servers/' + type);
	return new Server();
};

// 
// Load all of the resources in a directory recursively
// 
exports.loadResources = function(dir) {
	return exports.requireRecursive(dir || PATH.RESOURCES);
};

// 
// Load all of the models in a directory recursively
// 
exports.loadModels = function(dir) {
	return exports.requireRecursive(dir || PATH.MODELS);
};

// 
// Load all of the files in a directory structure recursively
// 
exports.requireRecursive = function(dir) {
	wrench.readdirRecursive(dir, function(err, files) {
		files.forEach(function(file) {
			require(path.join(dir, file));
		});
	});
};
