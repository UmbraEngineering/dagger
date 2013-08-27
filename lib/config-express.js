
var express = require('express');

exports.initialize = function(app) {

	// Log incomming requests
	app.express.use(function(req, res, next) {
		app.log('MESSAGE', req.protocol.toUpperCase() + ' ' + req.method.toUpperCase() + ' ' + req.url);
		next();
	});

	// Parse request bodies
	app.express.use(express.bodyParser());

	// Check for method overrides
	app.express.use(express.methodOverride());

	// Run through the router
	app.express.use(app.express.router);

};
