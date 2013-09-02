
exports.initialize = function(conf) {

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
	// Replace the native console.{log|warn|error} methods to add timestamps
	// 
	if (conf.logging.timestamps) {
		['log', 'warn', 'error'].forEach(function(method) {
			var orig = console[method];
			console[method] = function() {
				var timestamp = (new Date()).toJSON();
				timestamp = '[' + timestamp.replace('T', ' ').split('.')[0] + ']';
				var args = [timestamp].concat(Array.prototype.slice.call(arguments));
				orig.apply(console, args);
			};
		});
	}

	// 
	// Logging function
	// 
	var log = exports.log = function(type) {
		var logging = conf.logging.level;

		if (type === 'CRITICAL') {
			process.nextTick(onCritical);
		}

		// Check for log type "NONE"
		if (logging.indexOf('NONE') >= 0) {return;}

		// Check for log type "ALL"
		if (logging.indexOf('ALL') < 0) {
			// Check for the specific given log type
			if (logging.indexOf(type) < 0) {return;}
		}

		// Determine the correct logging method for this message
		var method = 'log';
		if (type === 'CRITICAL' || type === 'ERROR') {
			method = 'error';
		} else if (type === 'WARNING') {
			method = 'warn';
		}

		// Determine the correct prefix to add to the message
		var prefix = method;
		if (prefix === 'log') {
			prefix = 'info';
		}
		if (type === 'BUSIO' || type === 'SOCKETIO' || type === 'EVENTS') {
			prefix = 'debug';
		}

		// Log the message
		var args = Array.prototype.slice.call(arguments, 1);
		args.unshift(prefix + ':');
		console[method].apply(console, args);

		// If running in strict mode and a critical error occurs, stop the server
		if (type ==='CRITICAL' && conf.strictMode) {
			process.exit(1);
		}
	};
	
	// 
	// Handles shutting down the server in strict mode
	// 
	var onCritical = (conf.strictMode
		? function() {
			if (conf.logging.level.indexOf('CRITICAL') >= 0) {
				console.error('Critical error in strict mode; Stopping server...');
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
	var AppObject = exports.AppObject = function(root) {
		ee2.EventEmitter2.call(this, {
			wildcard: true,
			delimiter: '.'
		});
	};

	AppObject.prototype = new ee2.EventEmitter2();

	//
	// Override EventEmitter2::emit so that it logs all emitted events. This could
	// (and probably should) be removed from production builds, but I don't really
	// care that much..
	//
	AppObject.prototype.emit = function(event) {
		log(LOG.EVENTS, 'app:' + event);
		EventEmitter2.prototype.emit.apply(this, arguments);
	};

	// 
	// Returns a stack trace
	// 
	AppObject.prototype.stacktrace = function(arr) {
		try {
			throw new Error();
		} catch (e) {
			var stack = e.stack;
			if (arr) {
				stack = stack.split('\n');
			}

			return stack;
		}
	}
	
	// Return exports from the initialize method to simplify things
	return exports;

};