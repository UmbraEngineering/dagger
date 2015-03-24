
var io         = require('socket.io');
var winston    = require('winston');
var dagger     = require('../index');
var Class      = require('../class');
var conf       = require('../config');
var Request    = require('../request/socket');
var HttpError  = require('../http/error');

var Server = module.exports = Class.extend({

	init: function() {
		this.socketio = null;
	},

	// -------------------------------------------------------------

	// 
	// Bind socket.io to the HTTP server
	// 
	// @param {server} the HTTP(S) server
	// @return void
	// 
	createServer: function(server) {
		this.io = io(server);
		this.io.on('connection', this.onConnection.bind(this));
	},

	// -------------------------------------------------------------

	// 
	// Handles new incoming connections
	// 
	// @param {socket} the new socket
	// @return void
	// 
	onConnection: function(socket) {
		winston.info('New socket.io connection');

		socket.on('request', this.handleRequest.bind(this, socket));

		if (conf.ws.enableListeners) {
			socket.on('listen', this.handleListenRequest.bind(this, socket));
		}
	},

	// -------------------------------------------------------------

	// 
	// Handles an incomming request
	// 
	// @param {socket} the socket connection
	// @param {req} the request object
	// @param {callback} the response callback
	// @return void
	// 
	handleRequest: function(socket, req, callback) {
		var request = new Request(socket, req, callback);

		dagger.app.run(request)
			.catch(
				HttpError.catch(request)
			);
	},

	// 
	// Handles incoming listener requests
	// 
	// @param {socket} the socket connection
	// @param {req} the request object
	// @param {callback} the response callback
	// @return void
	// 
	handleListenRequest: function(socket, req, callback) {
		// 
	}

});
