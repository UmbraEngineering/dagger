
var conf = require('./conf');

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
// Color codes for colored output
// 
var colors = exports.colors = {
	info: 36,
	warn: 33,
	error: 31,
	debug: 90
};

var colored = exports.colored = function(type, message) {
	return '\033[' + colors[type] + 'm' + message + '\033[39m'
};

var pad = exports.pad = function(str) {
	var max = 5;

	if (str.length < max) {
		return str + new Array(max - str.length + 1).join(' ');
	}

	return str;
}

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
	if (method === 'log') {
		prefix = 'info';
	}
	if (type === 'BUSIO' || type === 'SOCKETIO' || type === 'EVENTS') {
		prefix = 'debug';
	}
	if (conf.logging.colorOutput) {
		prefix = '   ' + colored(prefix, pad(prefix) + ' -');
	} else {
		prefix += ':';
	}

	// Log the message
	var args = Array.prototype.slice.call(arguments, 1);
	args.unshift(prefix);
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
