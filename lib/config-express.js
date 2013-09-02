
var express  = require('express');
var logger   = require('./logger');

exports.initialize = function(app) {

	// Parse request bodies
	app.express.use(express.bodyParser());

	// Check for method overrides
	app.express.use(express.methodOverride());

	// Log incomming requests
	app.express.use(app.conf.logging.colorOutput ? logColored : logPlain);

		function logPlain(req, res, next) {
			app.log('MESSAGE', req.protocol.toUpperCase(), req.method.toUpperCase(), req.url, JSON.stringify(req.body));
			next();
		}

		function logColored(req, res, next) {
			app.log('MESSAGE', logger.colored('info', [
				req.protocol.toUpperCase(),
				req.method.toUpperCase(),
				req.url,
				JSON.stringify(req.body)
			].join(' ')));
			next();
		}

	// Add Dagger.js to X-Powered-By header
	app.express.use(function(req, res, next) {
		res.setHeader('X-Powered-By', 'Dagger.js, Express');
		next();
	});

	// Run through the router
	app.express.use(app.express.router);

};
