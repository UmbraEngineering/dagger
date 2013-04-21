
var exports = module.exports = function(conf) {

	var nextId = 1;

	var ee2 = require('eventemitter2');

// -------------------------------------------------------------

	// 
	// Logging type constants
	// 
	// NOTE: These should NEVER be modified by user-land code
	// 
	var LOG = exports.LOG = {
		NONE:      'NONE',
		ALL:       'ALL',

		BUSIO:     'BUSIO',
		SOCKETIO:  'SOCKETIO',
		EVENTS:    'EVENTS',
		MESSAGE:   'MESSAGE',
		WARNING:   'WARNING',
		ERROR:     'ERROR',
		CRITICAL:  'CRITICAL'
	};

	// 
	// Logging function
	// 
	var log = exports.log = function(type) {
		if (type === 'CRITICAL') {
			process.nextTick(onCritical);
		}

		// Check for log type "NONE"
		if (conf.logging.indexOf('NONE') >= 0) {return;}

		// Check for log type "ALL"
		if (conf.logging.indexOf('ALL') < 0) {

			// Check for the specific given log type
			if (conf.logging.indexOf(type) < 0) {return;}
		}

		// Determine the correct logging method for this message
		var method = 'log';
		if (type === 'CRITICAL' || type === 'ERROR') {
			method = 'error';
		} else if (type === 'WARNING') {
			method = 'warn';
		}

		// Log the message
		var args = Array.prototype.slice.call(arguments, 1);
		console[method].apply(console, args);

		if (type ==='CRITICAL' && )
	};
	
	// 
	// Handles shutting down the server in strict mode
	// 
	var onCritical = (conf.strictMode
		? function() {
			if (conf.logging.indexOf('CRITICAL') >= 0) {
				console.warn('Critical error in strict mode; Stopping server...');
			}
			process.exit(1);
		}
		: function() {
			// pass
		});

// -------------------------------------------------------------

	// 
	// AppObject Class
	// 

	Class.namespace(exports);
	Class('AppObject').Extends(ee2.EventEmitter2, {

		//
		// Base constructor. All inheriting classes that override this
		// method MUST call this with this.construct.parent(this) in the
		// overriding method.
		//
		construct: function(root) {
			this._uuid = nextId++;

			log(LOG.MESSAGE, 'Initializing <' + this.__class__ + '#' + this._uuid + '> instance');

			ee2.EventEmitter2.call(this, {
				wildcard: true,
				delimiter: '.'
			});
		},

		//
		// Override EventEmitter2::emit so that it logs all emitted events. This could
		// (and probably should) be removed from production builds, but I don't really
		// care that much..
		//
		emit: function(event) {
			var ctorName = (this === app) ? 'app' : this.__class__;
			log(LOG.EVENTS, ctorName + ':' + event);
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
		}

	});
	
	// Return exports from the initialize method to simplify things
	return exports;

};