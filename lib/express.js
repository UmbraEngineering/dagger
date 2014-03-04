
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

