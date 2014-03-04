
// 
// This creates the actual HTTP(S) servers that are used by express/socket.io
// under the hood.
// 

var fs            = require('fs');
var http          = require('http');
var https         = require('https');
var conf          = require('../conf');
var PATH          = require('../paths');
var logger        = require('../logger');
var EventEmitter  = require('events').EventEmitter;

var enabled = {
	http: conf.http && conf.http.enabled,
	https: conf.https && conf.https.enabled,
	ws: conf.ws && conf.ws.enabled,
	wss: conf.wss && conf.wss.enabled
};

// 
// We emit events on this module when requests come in
// 
exports = module.exports = new EventEmitter();

// 
// Expose the base server class for extending
// 
exports.Server = require('./base');

// 
// Create the HTTP server if we need one
// 
if (enabled.http || enabled.ws) {
	exports.http = http.createServer()
		.on('request', function(req, res) {
			exports.emit('http', req, res);
		})
		.on('close', function() {
			logger.message('HTTP server closed');
		})
		.listen(conf.http.port, conf.http.address, function() {
			logger.message('HTTP server listening at ' + conf.http.address + ':' + conf.http.port);
		});
}

// 
// Create the HTTPS server if we need one
// 
if (enabled.https || enabled.wss) {
	var keyFile = path.resolve(PATH.CONFIG, conf.https.keyFile);
	var certFile = path.resolve(PATH.CONFIG, conf.https.certFile);
	var caFile = conf.https.caFile && path.resolve(PATH.CONFIG, conf.https.caFile);

	var httpsConf = {
		key: fs.readFileSync(keyFile),
		cert: fs.readFileSync(certFile)
	};

	if (caFile) {
		httpsConf.ca = fs.readFileSync(caFile);
	}

	exports.https = https.createServer(httpsConf)
		.on('request', function(req, res) {
			exports.emit('https', req, res);
		});
		.on('close', function() {
			logger.message('HTTPS server closed');
		})
		.listen(conf.https.port, conf.https.address, function() {
			logger.message('HTTPS server listening at ' + conf.https.address + ':' + conf.https.port);
		});
}
