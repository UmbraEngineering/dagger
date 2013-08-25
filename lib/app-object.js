
var exports = module.exports = function(conf) {

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
	
	// Return exports from the initialize method to simplify things
	return exports;

};