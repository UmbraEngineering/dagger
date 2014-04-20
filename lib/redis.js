
var conf    = require('./conf');
var utils   = require('./utils');
var logger  = require('./logger');
var events  = require('events');

if (! conf.redis.enabled) {return;}

var redis      = exports.redis      = require('redis-url');
var pubClient  = exports.pubClient  = redis.connect(conf.redis.url);
var subClient  = exports.subClient  = redis.connect(conf.redis.url);

var emitter = exports.emitter = new events.EventEmitter();

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
