
var fs         = require('fs');
var http       = require('http');
var https      = require('https');
var winston    = require('winston');
var dagger     = require('../index');
var paths      = require('../paths');
var Class      = require('../class');
var conf       = require('../config');
var Request    = require('../request/http');
var HttpError  = require('../http/error');

var Server = module.exports = Class.extend({

	init: function() {
		this.server = null;
		this.isHttps = null;
	},

	// -------------------------------------------------------------

	// 
	// Create the server instance
	// 
	// @return void
	// 
	createServer: function() {
		if (conf.ssl && conf.ssl.enabled) {
			this.createHttpsServer();
		} else {
			this.createHttpServer();
		}
	},

	// 
	// Create an HTTP server instance
	// 
	// @return void
	// 
	createHttpServer: function() {
		this.isHttps = false;
		this.server = http.createServer(this.handleRequest.bind(this));
		this.server.listen(conf.http.port, conf.http.address, function() {
			winston.info('HTTP server listening on ' + conf.http.address + ':' + conf.http.port + '...');
		});
	},

	// 
	// Create an HTTPS server instance
	// 
	// @return void
	// 
	createHttpsServer: function() {
		var opts = { };

		if (conf.ssl.ca || conf.ssl.caFile) {
			opts.ca = conf.ssl.ca || readConfFile(conf.ssl.caFile);
		}

		if (conf.ssl.key || conf.ssl.keyFile) {
			opts.key = conf.ssl.key || readConfFile(conf.ssl.keyFile);
		}

		if (conf.ssl.cert || conf.ssl.certFile) {
			opts.cert = conf.ssl.cert || readConfFile(conf.ssl.certFile);
		}

		if (conf.ssl.pfx || conf.ssl.pfxFile) {
			opts.pfx = conf.ssl.pfx || readConfFile(conf.ssl.pfxFile);
		}

		this.isHttps = true;
		this.server = https.createServer(opts, this.handleRequest.bind(this));
		this.server.listen(conf.http.port, conf.http.address, function() {
			winston.info('HTTPS server listening on ' + conf.http.address + ':' + conf.http.port + '...');
		});
	},

	// -------------------------------------------------------------

	// 
	// Handles an incomming request
	// 
	// @param {req} the request object
	// @param {res} the response object
	// @return void
	// 
	handleRequest: function(req, res) {
		var request = new Request(req, res);

		request
			.getRequestBody()
			.then(
				function() {
					return dagger.app.run(request);
				},
				HttpError.catch(request)
			)
			.catch(
				HttpError.catch(request)
			);
	}

});

// -------------------------------------------------------------

// 
// Reads a file from
// 
// @param {file} the file to read
// @return buffer
// 
function readConfFile(file) {
	return fs.readFileSync(paths.resolve('config', file));
}
