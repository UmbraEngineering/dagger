
var url        = require('url');
var Server     = require('./base');
var conf       = require('../conf');
var socketio   = require('socket.io');
var merge      = require('merge-recursive');
var Request    = require('../request');
var HttpError  = require('../http-meta').HttpError;

var SocketServer = module.exports = Server.extend({

	routes: null,
	routeRegexes: null,

	init: function() {
		this._super();

		this.routes = { };
		this.routeRegexes = { };

		if (this.nonSecure) {
			this.ws = socketio();
			this.ws.sockets.on('connection', this.handleSocket.bind(this, 'ws'));
		}

		if (this.secure) {
			this.wss = socketio();
			this.wss.sockets.on('connection', this.handleSocket.bind(this, 'wss'));
		}

		this.bind('onConnection');
		this.on('connection', this.onConnection);
	},

	// 
	// Listen for requests of a specific type
	// 
	listen: function(method, route, opts, callback) {
		if (opts && ! callback) {
			callback = opts, opts = void(0);
		}

		opts = merge({ allowNonSecure: true, allowSecure: true }, opts || { });

		route = this._routes[route] || this.createRoute(route);

		if (! this.routes[method]) {
			this.routes[method] = [ ];
		}

		this.routes[method].push({
			route: route,
			allowSecure: opts.allowSecure,
			allowNonSecure: opts.allowNonSecure,
			callback: callback
		});
	},

	// 
	// Emits events for new incomming connections
	// 
	handleSocket: function(protocol, socket) {
		this.emit('connection', socket, protocol);
		this.emit('connection.' + protocol, socket);
	},

	// 
	// Bind listeners to a connection and wait for incomming requests
	// 
	onConnection: function(socket, protocol) {
		socket.on('*', this.onRequest.bind(this, socket, protocol));
	},

	// 
	// Handle an individual request
	// 
	onRequest: function(socket, protocol, req, callback) {
		var match;
		var patams;
		var url = req.url;
		var routes = this.routes[req.method];

		for (var i = 0, c = routes.length; i < c; i++) {
			if (params = routes[i].route.match(url)) {
				match = routes[i];
				break;
			}
		}

		if (! match) {
			var request = new Request();
			request.initSocket(socket, req, {}, {}, callback);
			(new HttpError(404, 'Cannot handle route "' + req.url + '"')).send(request);
			return;
		}

		process.nextTick(function() {
			match.callback(socket, req, callback);
		});
	},

	// 
	// Creates route regex objects for routing
	// 
	createRoute: function(route) {
		return this._routeRegexes[route] = this._routeRegexes[route] ||
			new ExpressRoute('', route, [ ], {strict: false, sensitive: false});
	}

});
