
var fs         = require('fs');
var conf       = require('./conf');
var paths      = require('./paths');
var AppObject  = require('./app-object');
var logger     = require('./logger');
var express    = require('./express');
var socketio   = require('./socket-io');

var App = module.exports = AppObject.extend({

	opts: {
		init: null,
		middleware: [ ]
	},

	init: function(opts) {
		this.opts = merge({ }, this.opts, opts);

		if (this.opts.init) {
			this.opts.init.call(this);
		}

		this.createServer();

		if (conf.http.enabled) {
			this.bindExpressServer();
		}
		
		if (conf.ws.enabled) {
			this.bindSocketioServer();
		}
	},

	// 
	// Create the HTTP(S) server for the application
	// 
	createServer: function() {
		this.emit('createServer');

		// Create HTTPS server
		if (conf.ssl && conf.ssl.enabled) {
			var opts = {
				key: fs.readFileSync(paths.resolve('CONFIG', conf.ssl.keyFile)),
				cert: fs.readFileSync(paths.resolve('CONFIG', conf.ssl.certFile))
			};

			if (conf.ssl.caFile) {
				opts.ca = fs.readFileSync(paths.resolve('CONFIG', conf.ssl.caFile));
			}

			this.server = require('https').createServer(opts);
			this.server.listen(conf.http.port, conf.http.address, function() {
				logger.message('HTTP server listening at ' + conf.http.address + ':' + conf.http.port);
			});
		}

		// Create HTTP server
		else {
			this.server = require('http').createServer();
			this.server.listen(conf.http.port, conf.http.address, function() {
				logger.message('HTTP server listening at ' + conf.http.address + ':' + conf.http.port);
			});
		}

		this.emit('serverCreated');
	},

	// 
	// Bind express to the HTTP(S) server
	// 
	bindExpressServer: function() {
		this.emit('bindExpressServer');
		express.bindToServer(this.server);
		this.opts.middleware.forEach(express.addRequestMiddleware);
		this.emit('expressServerBound');
	},

	// 
	// Bind socket.io to the HTTP(S) server
	// 
	bindSocketioServer: function() {
		this.emit('bindSocketioServer');
		socketio.bindToServer(this.server);
		this.opts.middleware.forEach(socketio.addRequestMiddleware);
		this.emit('socketioServerBound');
	}

});
