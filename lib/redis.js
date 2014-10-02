
var url     = require('url');
var conf    = require('./conf');
var utils   = require('./utils');
var logger  = require('./logger');
var events  = require('events');

var redis = exports.redis = require('redis');
var redisUrl = url.parse(conf.redis.url);

exports.createClient = function(opts) {
	var client = redis.createClient(redisUrl.port, redisUrl.hostname, {no_ready_check: true});

	var auth = (redisUrl.auth && redisUrl.auth.split(':'));

	if (auth) {
		client.auth(auth[1] || auth[0], function(err) {
			if (err) {
				console.error('Redis Auth Error: ', (err.stack || err.message || err));
			}
		});
	}

	// Select the data if one is given
	if (auth && auth[1] && (! opts || opts.selectDB)) {
		client.select(auth[0]);
		client.on('connect', function() {
			client.send_anyways = true
			client.select(auth[0]);
			client.send_anyways = false;
		});
	}

	return client;
};

exports.emit = function(event, data) {
	data = JSON.stringify({
		event: event,
		data: data
	});
	
	pubClient.publish(conf.redis.channel, data);
};

exports.on = function(event, callback) {
	emitter.on(event, callback);
};

exports.off = function(event, callback) {
	emitter.removeListener(event, callback);
};

if (conf.redis.enabled) {
	var emitter    = exports.emitter    = new events.EventEmitter();
	var pubClient  = exports.pubClient  = exports.createClient({ selectDB: false });
	var subClient  = exports.subClient  = exports.createClient({ selectDB: false });

	subClient.on('subscribe', function() {
		logger.message('Redis client listening for events...');
	});

	subClient.on('message', function(channel, data) {
		try {
			data = JSON.parse(data);
		} catch (err) {
			logger.error('Failed to parse redis pub/sub message');
			Error.getStackTrace({ split: true }).forEach(function(line) {
				logger.error('  ' + line);
			});
			logger.error('"' + data + '"');
			return;
		}

		emitter.emit(data.event, data.data);
	});

	subClient.subscribe(conf.redis.channel);
}

