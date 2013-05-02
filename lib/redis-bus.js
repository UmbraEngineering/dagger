
var redis = require('redis-url');

exports.initialize = function(app) {
	Class.namespace(app);

	// 
	// Redis bus class
	// 

	Class('RedisBus').Extends('AppObject', {

		client: null,

		// 
		// Constructor
		// 
		construct: function(conf) {
			this.construct.parent(this);

			this.createClient(conf);
		},

		// 
		// Creates a redis client and stores it for future use.
		// 
		createClient: function(conf) {
			if (! this.client) {
				this.client = redis.connect(conf.url);
			}
		}

		// 
		// TODO: Code for subscribing to the pub/sub channel
		// 

	});

};
