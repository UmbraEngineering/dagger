
var conf      = require('./conf');
var socketio  = require('socket.io');
var httpMeta  = require('./http-meta');
var Request   = require('./request/socket');

// Borrow the route class from express for parsing urls for
// socket.io requests in a compatable way
var ExpressRoute = require(
	path.join(app.PATH.MODULES.EXPRESS, 'lib/router/route')
);

// 
// We store active routes here
// 
var routes = httpMeta.methodFuncs.reduce(function(mem, method) {
	mem[method] = [ ];
	return mem;
}, { });

// 
// Listens on the given HTTP(S) server for socket requests
// 
exports.bindToServer = function(server) {
	var socketServer = socketio.listen(server);

	// Start listening for new connections
	socketServer.on('connection', exports.onConnection);

	return socketServer;
};

// 
// Called when a new connection comes in; Listens for incoming requests
// 
exports.onConnection = function(socket) {
	socket.on('request', exports.onRequest.bind(socket));

	if (conf.ws.enablePushSupport) {
		socket.on('listen', exports.onListen.bind(socket));
	}
};

// 
// Called when a new request comes in on an active connection
// 
exports.onRequest = function(socket, req, callback) {
	// Create a normalized request object
	req = new Request(socket, req, callback);

	// 
	// TODO Handle Middleware
	// 

	// Find the first matching route
	var routesForMethod = routes[req.method.toLowerCase()];
	for (var i = 0, c = routesForMethod.length; i < c; i++) {
		var route = routesForMethod[i];
		if (route.route.match(req.pathname)) {
			req.params = route.route.params;
			return process.nextTick(function() {
				route.func(req);
			});
		}
	}

	// If no matching route was found, output a 404 Not Found error
	req.respond(404, { error: 'Cannot ' + req.method + ' ' + req.pathname });
};

// 
// Called when a new listener request comes in on an active connection
// 
exports.onListen = function(socket, req, callback) {
	// 
	// TODO Handle events listeners
	// 
};

// 
// Creates route regex objects for routing
// 
var routeRegexes = { };
exports.createRoute = function(route) {
	return routeRegexes[route] = routeRegexes[route] ||
		new ExpressRoute('', route, [ ], {strict: false, sensitive: false});
};

// 
// Create methods for listening for requests
// 
httpMeta.methodFuncs.forEach(function(method) {
	exports[method] = function(route, callback) {
		routes[method].push({
			routeString: route,
			route: exports.createRoute(route),
			func: callback
		});
	};
});
