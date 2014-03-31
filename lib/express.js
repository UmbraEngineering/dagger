
var conf      = require('./conf');
var express   = require('express');
var httpMeta  = require('./http-meta');
var Request   = require('./request/http');
var models    = require('./models');

var expressApp;

// 
// Listens on the given HTTP(S) server for socket requests
// 
exports.bindToServer = function(server) {
	expressApp = expressApp || express();
	server.on('request', expressApp);

	// Parse request bodies
	expressApp.use(express.bodyParser({ strict: false }));

	// Check for method overrides
	expressApp.use(express.methodOverride());

	// Add Dagger.js to X-Powered-By header
	expressApp.use(function(req, res, next) {
		res.setHeader('X-Powered-By', 'Dagger.js');
		next();
	});

	// Run through the router
	expressApp.use(expressApp.router);

	// Final handler for 404s
	expressApp.use(function(req, res) {
		var err = new httpMeta.HttpError(404, 'Cannot ' + req.method + ' ' + req.url);
		res.json(404, err.toJSON());
	});
};

// 
// Adds a middleware function to the Socket.io request handler
// 
exports.requestMiddlewares = [ ];
exports.addRequestMiddleware = function(callback) {
	exports.requestMiddlewares.push(callback);
};

// 
// Return a new Request object
// 
exports.createRequest = function(req, res, next) {
	return new Request(req, res, next);
};

// 
// Create methods for listening for requests
// 
httpMeta.methodFuncs.forEach(function(method) {
	exports[method] = function(route, callback) {
		return expressApp[method](route, callback);
	};
});
