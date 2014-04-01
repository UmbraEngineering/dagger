
var path      = require('path');
var async     = require('async');
var crypto    = require('crypto');
var conf      = require('./conf');
var paths     = require('./paths');
var socketio  = require('socket.io');
var httpMeta  = require('./http-meta');
var Request   = require('./request/socket');
var models    = require('./models');
var logger    = require('./logger');

// Borrow the route class from express for parsing urls for
// socket.io requests in a compatable way
var ExpressRoute = require(
	path.join(paths.MODULES.EXPRESS, 'lib/router/route')
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

	Object.keys(conf.ws.socketIO).forEach(function(key) {
		socketServer.set(key, conf.ws.socketIO[key]);
	});

	exports.setStore(socketServer);

	// Start listening for new connections
	socketServer.sockets.on('connection', exports.onConnection);

	return socketServer;
};

// 
// Load the correct store based on config
// 
exports.setStore = function(io) {
	switch (conf.ws.store) {
		case 'memory':
			var MemoryStore = require('socket.io/lib/stores/memory');
			
			io.set('store', new MemoryStore());
		break;

		case 'redis':
			var RedisStore  = require('socket.io/lib/stores/redis');
			var redis       = require('./redis').redis;
			var pub         = redis.createClient();
			var sub         = redis.createClient();
			var client      = redis.createClient();

			io.set('store', new RedisStore({
				redisPub: pub,
				redisSub: sub,
				redisClient: client
			}));
		break;
	}
};

// 
// Called when a new connection comes in; Listens for incoming requests
// 
exports.onConnection = function(socket) {
	if (conf.logging.requests.sockets) {
		logger.message('New socket connection');
	}

	socket.on('request', exports.onRequest.bind(null, socket));

	if (conf.ws.enablePushSupport) {
		socket.on('listen', exports.onListen.bind(null, socket));
	}
};

// 
// Adds a middleware function to the Socket.io request handler
// 
exports.requestMiddlewares = [ ];
exports.addRequestMiddleware = function(callback) {
	exports.requestMiddlewares.push(callback);
};

// 
// Called when a new request comes in on an active connection
// 
// Requests are formatted like so:
// 
//   {
//     method: 'POST',
//     url: '/people',
//     headers: [
//       ['content-type', 'application/json']
//     ],
//     body: {
//       name: 'bob'
//     }
//   }
// 
exports.onRequest = function(socket, req, callback) {
	// Create a normalized request object
	req = new Request(socket, req, callback);

	// Add the X-Powered-By header
	req.setHeader('X-Powered-By', 'Dagger.js');

	// Call all of the middleware functions
	async.forEachSeries(exports.requestMiddlewares,
		function(middleware, next) {
			middleware(socket, req, next);
		},
		function(err) {
			// Send any middleware errors to the client
			if (err) {
				if (err === true) {return;}
				err = new HttpError(err);
				return err.send(req);
			}

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
			(new HttpError(404, 'Cannot ' + req.method + ' ' + req.pathname)).send(req);
		});
};

// 
// Called when a new listener request comes in on an active connection
// 
// Requests are formatted like so:
// 
//   {
//     model: 'person',
//     event: 'update',
//     filter: {
//       name: {$regex: 'bob'},
//       age: {$gte: 21}
//     },
//     volatile: false
//   }
// 
exports.onListen = function(socket, req, callback) {
	var respond = Request.prototype.sendResponse.bind({callback: callback});
	var respondWithError = function(err) {
		respond(err.status, err.toJSON());
	};

	if (! req.model) {
		return respondWithError(new HttpError(400, 'Listener requests must contain a model attribute'));
	}

	try {
		var model = models.require(req.model).model;
	} catch (err) {
		return respondWithError(new HttpError(400, 'Cannot load the model "' + req.model + '"'));
	}

	var listenerId = hash(req);
	var event = req.event || 'create';

	try {
		var matchesFilter = req.filter ? createFilter(req.filter) : null;
	} catch (err) {
		// Handle invalid syntax in $regex filters
		var status = /Invalid regular expression/.test(err.message) ? 400 : 500;
		return respondWithError(new HttpError(status, err));
	}

	respond(200, {
		emits: listenerId,
		off: 'unlisten:' + listenerId
	});

	model.subscribe(event, onEvent);
	socket.on('unlisten:' + listenerId, stopListening);
	socket.on('disconnect', stopListening);

	function onEvent(obj) {
		if (! req.filter || matchesFilter(obj)) {
			emit(listenerId, obj);
		}
	}

	function emit(event, data) {
		if (req.volatile) {
			socket.volatile.emit(event, data);
		} else {
			socket.emit(event, data);
		}
	}

	function stopListening() {
		model.unsubscribe(event, onEvent);
		socket.removeListener('unlisten:' + listenerId, stopListening);
		onEvent = null;
		emit = null;
		stopListening = null;
	}
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

// 
// Get an sha1 hash from an object
// 
function hash(data) {
	data = JSON.stringify(data);
	return crypto.createHash('sha1').update(data).digest('hex');
}

// 
// Returns a function for filtering objects
// 
function createFilter(filter) {
	var regexes = [ ];

	return function(obj) {
		return Object.keys(filter).reduce(function(memo, key) {
			var value = obj[key];
			var rules = filter[key];

			if (typeof rules !== 'object') {
				return (memo && value === rules);
			}

			if (rules == null) {
				return memo;
			}

			// 
			// NOTE: I may decide to add broader filter support in the future (like
			// adding $all and $elemMatch), but for the time being, this is it.
			// 
			return Object.keys(rules).reduce(function(memo, key) {
				var result;
				var ruleValue = rules[key];

				switch (key) {
					case '$eq':
						result = (value === ruleValue);
					break;

					case '$neq':
						result = (value !== ruleValue);
					break;

					case '$lt':
						result = (value < ruleValue);
					break;

					case '$lte':
						result = (value <= ruleValue);
					break;

					case '$gt':
						result = (value > ruleValue);
					break;

					case '$gte':
						result = (value >= ruleValue);
					break;

					case '$in':
						result = (ruleValue.indexOf(value) >= 0);
					break;

					case '$nin':
						result = (ruleValue.indexOf(value) < 0);
					break;

					case '$exists':
						result = ruleValue ? (value !== void(0)) : (value === void(0));
					break;

					case '$regex':
						var regex = regexes[ruleValue] = (regexes[ruleValue] || filterRegex(ruleValue));
						result = regex.test(value);
					break;
				}

				return (memo && result);
			}, memo);
		}, true);
	};
}

// 
// Generate a regular expression given a pattern string
// 
function filterRegex(string) {
	if (string[0] !== '/') {
		return new RegExp(string);
	}

	var end = string.lastIndexOf('/');
	var flags = string.slice(end + 1);
	string = string.slice(1, end);

	return new RegExp(string, flags);
}
