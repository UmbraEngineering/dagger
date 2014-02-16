
var redis     = require('./redis');
var mongoose  = require('./mongoose');

exports.create = function(name, schema) {
	// Mark the model as new if it is
	schema.pre('save', function(done) {
		this.wasNew = this.isNew;
		done();
	});

	// List for save events
	schema.post('save', function() {
		if (this.wasNew) {
			// Emit a create event
			redis.emit([name, 'create'].join(':'), this.toObject());
		} else {
			// Emit an update event
			redis.emit([name, 'update', this._id].join(':'), this.toObject());
		}
	});

	// Listen for remove events
	schema.post('remove', function() {
		redis.emit([name, 'remove', this._id].join(':'), this.toObject());
	});

	// Create the subscription method, used for watching the redis bus for
	// push events. This is used for socket.io live pushing
	schema.statics.subscribe = function(event, objectId, callback) {
		if (arguments.length === 1) {
			callback = event;
			event = 'create';
		} else if (arguments.length === 2) {
			callback = objectId;
			objectId = null;
		}

		event = (objectId ? [name, event, objectId] : [name, event]).join(':');

		redis.on(event, callback);
	};

	// Remove a previously set event subscription
	schema.statics.unsubscribe = function(event, objectId, callback) {
		if (arguments.length === 1) {
			callback = event;
			event = 'create';
		} else if (arguments.length === 2) {
			callback = objectId;
			objectId = null;
		}

		event = (objectId ? [name, event, objectId] : [name, event]).join(':');

		redis.off(event, callback);
	};

	return mongoose.model(name, schema);;
};

