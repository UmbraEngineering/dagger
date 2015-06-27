
var url           = require('url');
var redis         = require('redis');
var conf          = require('../config');
var winston       = require('winston');
var EventEmitter  = require('eventemitter3');

var auth;
var parsed;
var pubClient;
var subClient;
var eventBus;
var stripNamespace;

// 
// Determines if redis is enabled
// 
// @return boolean
// 
exports.enabled = function() {
	return !! conf.redis.enabled;
};

// -------------------------------------------------------------

// 
// Publishes an event on the event bus
// 
// @param {event} the event name to publish
// @param {data} additional data to send with the event
// @return void
// 
exports.publish = function(event, data) {
	if (exports.enabled()) {
		pubClient.publish(channel(event), JSON.stringify(data));
	}
};

// 
// Subscribes to a new event
// 
// @param {eventPattern} the event to subscribe to
// @return void
// 
exports.subscribe = function(eventPattern) {
	if (exports.enabled()) {
		subClient.psubscribe(channel(eventPattern));
	}
};

// 
// Unsubscribe from an event
// 
// @param {eventPattern} the event to unsubscribe from
// @return void
// 
exports.unsubscribe = function(eventPattern) {
	if (exports.enabled()) {
		subClient.punsubscribe(channel(eventPattern));
	}
};

// -------------------------------------------------------------

// 
// Start listening for an event to come in on the bus
// 
// @param {eventPattern} the event to listen for
// @param {func} the function to run
// @return void
// 
exports.on = function(eventPattern, func) {
	if (exports.enabled()) {
		// If we were not previously subscribed to this channel, subscribe
		if (! eventBus.listeners(eventPattern, true)) {
			exports.subscribe(eventPattern);
		}
		eventBus.on(eventPattern, func);
	}
};

// 
// Start listening for an event to come in on the bus once
// 
// @param {eventPattern} the event to listen for
// @param {func} the function to run
// @return void
// 
exports.once = function(eventPattern, func) {
	if (exports.enabled()) {
		// If we were not previously subscribed to this channel, subscribe
		if (! eventBus.listeners(eventPattern, true)) {
			exports.subscribe(eventPattern);
		}
		eventBus.once(eventPattern, function() {
			// If, after removing this one-time listener, there are no more
			// listeners on this event, we can unsubscribe
			if (! eventBus.listeners(eventPattern, true)) {
				exports.unsubscribe(eventPattern);
			}
			func.apply(this, arguments);
		});
	}
};

// 
// Stop listening for an event to come in on the bus
// 
// @param {eventPattern} the event not to listen for
// @param {func} the function not to run
// @return void
// 
exports.off = function(eventPattern, func) {
	if (exports.enabled()) {
		eventBus.removeListener(eventPattern, func);
		// If there are no more listeners on this channel, we can unsubscribe
		if (! eventBus.listeners(eventPattern, true)) {
			exports.unsubscribe(eventPattern);
		}
	}
};

// 
// Publishes an event on the event bus
// 
// @param {event} the event name to publish
// @param {data} additional data to send with the event
// @return void
// 
exports.emit = function(event, data) {
	if (exports.enabled()) {
		exports.publish(event, data);
	}
};

// -------------------------------------------------------------

parseConfig();

if (exports.enabled()) {
	eventBus = new EventEmitter();
	pubClient = exports.pubClient = createClient();
	subClient = exports.subClient = createClient();

	subClient.on('pmessage', function(pattern, channel, data) {
		try {
			data = JSON.parse(data);
		} catch (err) {
			winston.error('Failed to parse redis pub/sub event data as JSON; dropping this event...');
			winston.error('Data received: ' + data);
			return;
		}

		eventBus.emit(event(pattern), event(channel), data);
	});
}

// -------------------------------------------------------------

// 
// Parses the configuration and prepares for init
// 
// @return void
// 
function parseConfig() {
	conf.redis = conf.redis || { };

	if (conf.redis.url) {
		parsed = url.parse(conf.redis.url);

		if (parsed.auth) {
			auth = parsed.auth.split(':');
			auth = auth[1] || auth[0];
		}
	}

	if (conf.redis.namespace) {
		stripNamespace = new RegExp('^' + conf.redis.namespace + '\\:');
	}
}

// 
// Opens a new connection to the redis server
// 
// @return object
// 
function createClient() {
	var client = redis.createClient(parsed.port, parsed.hostname, conf.redis.options);

	client.on('connect', function() {
		winston.info('Connected to redis at redis://' + parsed.hostname + ':' + parsed.port);
	});

	client.on('error', function(err) {
		winston.error('Failed to open a connection to redis server.');
		winston.error(err);
	});

	if (auth) {
		client.auth(auth);
	}

	return client;
}

// 
// Returns the proper channel to pub/sub on for a given event
// 
// @param {event} the event to listen to
// @return string
// 
function channel(event) {
	if (conf.redis.namespace) {
		return conf.redis.namespace + ':' + event;
	}

	return event;
}

// 
// Returns an event name from a redis channel name
// 
// @param {channel} the redis channel
// @return string
// 
function event(channel) {
	if (stripNamespace) {
		return channel.replace(stripNamespace, '');
	}

	return channel;
}
