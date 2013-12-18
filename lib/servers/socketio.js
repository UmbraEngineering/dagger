
var url        = require('url');
var conf       = require('../conf');
var servers    = require('./index');
var socketio   = require('socket.io');
var merge      = require('merge-recursive');
var Request    = require('../request');
var HttpError  = require('../http-meta').HttpError;

var SocketServer = module.exports = servers.Server.extend({

	routes: null,
	routeRegexes: null,

	init: function(opts) {
		this._super(opts);

		this.routes = { };
		this.routeRegexes = { };

		if (servers.http) {
			this.ws = socketio.listen(servers.http);
			this.ws.sockets.on('connection', this.onConnection.bind(this, 'ws'));
		}

		if (servers.https) {
			this.wss = socketio.listen(servers.https);
			this.wss.socketio.on('connection', this.onConnection.bind(this, 'wss'));
		}
	},

	// 
	// Listen for requests of a specific type
	// 
	listen: function(method, route, callback) {
		route = this._routes[route] || this.createRoute(route);

		if (! this.routes[method]) {
			this.routes[method] = [ ];
		}

		this.routes[method].push({
			route: route,
			callback: callback
		});
	},

	// 
	// Bind listeners to a connection and wait for incomming requests
	// 
	onConnection: function(protocol, socket) {
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
