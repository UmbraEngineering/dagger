
var url     = require('url');
var conf    = require('./conf');
var utils   = require('./utils');
var logger  = require('./logger');
var events  = require('events');

if (! conf.redis.enabled) {return;}

var redis = exports.redis = require('redis');
var redisUrl = url.parse(conf.redis.url);

exports.createClient = function(opts) {
	var client = redis.createClient(redisUrl.port, redisUrl.hostname, {no_ready_check: true});
	client.auth(redisUrl.auth.split(':')[1]);

	if (! opts || ! opts.selectDB) {
		client.select(database);
		client.on('connect', function() {
			client.send_anyways = true
			client.select(database);
			client.send_anyways = false;
		});
	}

	return client;
};

var emitter    = exports.emitter    = new events.EventEmitter();
var pubClient  = exports.pubClient  = exports.createClient({ selectDB: false });
var subClient  = exports.subClient  = exports.createClient({ selectDB: false });

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
