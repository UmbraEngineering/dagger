
var express = require('express');

exports.initialize = function(app) {

	// Parse request bodies
	app.express.use(express.bodyParser());

	// Check for method overrides
	app.express.use(express.methodOverride());

	// Run through the router
	app.express.use(app.express.router);

};
