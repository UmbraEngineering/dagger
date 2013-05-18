
var redis = require('redis-url');

exports.initialize = function(app) {
	Class.namespace(app);

	// 
	// Redis bus class
	// 

	Class('RedisBus').Extends('AppObject', {

		pubClient: null,
		subClient: null,

		// 
		// Constructor
		// 
		construct: function(conf) {
			this.construct.parent(this);

			this.conf = conf;
			this.createClient();
		},

		// 
		// Creates a redis client and stores it for future use.
		// 
		createClients: function() {
			if (! this.subClient) {
				this.subClient = redis.connect(this.conf.url);
				this.subClient.on('message', _.bind(this.onMessage, this));
				this.subClient.subscribe(this.conf.pubSubChannel)
			}

			if (! this.pubClient) {
				this.pubClient = redis.connect(this.conf.url);
			}
		},

		// 
		// Starts listening for messages once successfully subscribed
		// 
		onMessage: function(channel, message) {
			this.emit('message', message);
		},

		// 
		// Publish a message to the channel
		// 
		pub: function(message) {
			this.pubClient.publish(this.conf.pubSubChannel, message);
		}

	});

};
