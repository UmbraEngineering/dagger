
var express = require('express');

exports.initialize = function(app) {

	// Parse request bodies
	app.express.use(express.bodyParser());

	// Check for method overrides
	app.express.use(express.methodOverride());

	// Log incomming requests
	app.express.use(function(req, res, next) {
		app.log('MESSAGE', req.protocol.toUpperCase(), req.method.toUpperCase(), req.url, req.body);
		next();
	});

	// Add Dagger.js to X-Powered-By header
	app.express.use(function(req, res, next) {
		res.setHeader('X-Powered-By', 'Dagger.js, Express');
		next();
	});

	// Run through the router
	app.express.use(app.express.router);

};
