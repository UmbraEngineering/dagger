
var nextId = 1;

var ee2 = require('eventemitter2');

// 
// AppObject Class
// 

Class.namespace(exports);
Class('AppObject').Extends(ee2.EventEmitter2, {

	// 
	// Logging level constants
	// 
	LOG_NONE:     -1,
	LOG_MESSAGE:   1,
	LOG_WARNING:   2,
	LOG_ERROR:     3,
	LOG_CRITICAL:  4,

	//
	// Base constructor. All inheriting classes that override this
	// method MUST call this with this.construct.parent(this) in the
	// overriding method.
	//
	construct: function(root) {
		this._uuid = nextId++;

		// TODO Load config here, BEFORE the this.log call below

		this.log(this.LOG_MESSAGE, 'Initializing <' + this.__class__ + '#' + this._uuid + '> instance');

		ee2.EventEmitter2.call(this, {
			wildcard: true,
			delimiter: '.'
		});

		// DEBUG This is here so that build errors actually log something useful
		this.on('error.build', function(err) { throw err; });
	},

	//
	// Override EventEmitter2::emit so that it logs all emitted events. This could
	// (and probably should) be removed from production builds, but I don't really
	// care that much..
	//
	emit: function(event) {
		var ctorName = (this === app) ? 'app' : this.__class__;
		log(ctorName + ':' + event);
		EventEmitter2.prototype.emit.apply(this, arguments);
	},

	//
	// Adds an extra method to all eventemitter2 objects called emits() that
	// returns an emitter function
	//
	// eg.
	//   var foo = new EventEmitter2({ ... });
	//   var emit = foo.emits('event', 'arg1');
	//   emit('arg2', 'arg3');
	//
	emits: function() {
		var args = _.toArray(arguments);
		args.unshift(this);
		args.unshift(this.emit);
		return _.bind.apply(_, args);
	},

	//
	// Adds an extra method to all eventemitter2 objects called reemit()
	// that causes all emitted events by one ee2 to be re-emitted by another.
	//
	// eg.
	//   var eeA = new EventEmitter2({ ... });
	//   var eeB = new EventEmitter2({ ... });
	//   
	//   eeA.on('foo', eeB.reemit());
	//   eeA.onAny(eeB.reemit());
	//   eeA.onAny(eeB.reemit('.fromA'));
	//   eeA.onAny(eeB.reemit(null, 'arg1', 'arg2'));
	//
	reemit: function(eventModifier) {
		var self = this;
		var boundArgs = _.toArray(arguments).slice(1);

		return function() {
			var event = this.event;
			var args = boundArgs.concat(_.toArray(arguments));

			// Allow events to be remapped to other event names
			//
			// eg.
			//   a.on('foo', b.reemit('.bar')) => 'foo.bar'
			//   a.on('foo', b.reemit('bar.')) => 'bar.foo'
			//   a.on('foo', b.reemit('bar')) => 'bar'
			//
			if (eventModifier) {
				if (eventModifier[0] === '.') {
					event += eventModifier;
				} else if (eventModifier[eventModifier.length - 1] === '.') {
					event = eventModifier + event;
				} else {
					event = eventModifier;
				}
			}

			args.unshift(event);
			self.emit.apply(self, args);
		};
	},

	// 
	// Emits multiple events at the same time, optionally with a set prefix
	// 
	// eg.
	//   foo.emitMany('bar.', ['a', 'b', 'c']);
	// 
	// is the same as
	//   foo.emit('bar.a');
	//   foo.emit('bar.b');
	//   foo.emit('bar.c');
	// 
	emitMany: function(prefix, events) {
		if (arguments.length === 1) {
			events = prefix; prefix = '';
		}

		for (var i = 0, c = events.length; i < c; i++) {
			this.emit(prefix + events[i]);
		}
	},

	// 
	// {emitsMany} is to {emitMany} as {emits} is to {emit}
	// 
	emitsMany: function() {
		var args = _.toArray(arguments);
		args.unshift(this);
		args.unshift(this.emitMany);
		return _.bind.apply(_, args);
	},

	// 
	// Logs messages to the console based on severity and the
	// configured log level
	// 
	log: function(level) {
		if (app.config.logLevel > level) {return;}
		if (app.config.logLevel <= this.LOG_NONE) {return;}

		var args = Array.prototype.slice.call(arguments, 1);
		console.log.apply(console, args);
	}

});
