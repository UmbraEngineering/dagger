
var oath     = require('oath');
var redis    = require('../redis');
var IdStore  = require('./index').IdStore;
var app      = require('../index').app;

var RedisIdStore = exports.IdStore = function() {
	// 
};

RedisIdStore.prototype = new IdStore();

RedisIdStore.prototype.next = function(model) {
	var promise = new oath();

	redis.incr('id_store_' + model, function(err, value) {
		if (err) {
			return promise.reject(err);
		}

		promise.resolve(value);
	});
	
	return promise;
};
