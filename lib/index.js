
// First things first, load in the class framework
global.Class = require('classes').Class;

// Load in the initial AppObject class
var AppObject = require('./app-object').AppObject;

// Load in other libraries
var express   = require('express');
var socketio  = require('socket.io');


// This function is called by the program using dagger. It initializes everything
// and gets the app up and running
exports.initialize = function(root) {
	// Create the root app object
	var app = new AppObject(root);

	// Expose the AppObject class
	app.AppObject = AppObject;

	// Load the model class
	require('./model').initialize(app);

	// Create the express server
	// ...

	// Create the Socket.IO server
	// ...

	return app;
};
