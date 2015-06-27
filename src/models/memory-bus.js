
var conf          = require('../config');
var winston       = require('winston');
var minimatch     = require('minimatch');

var listeners = { };
var eventPatternCache = { };

function init() {
	if (exports.enabled()) {
		winston.debug('No redis configuration setup; falling back to memory event bus.');
		listeners = { };
	}
}

// -------------------------------------------------------------

// 
// Determines if the memory event bus is enabled
// 
// @return boolean
// 
exports.enabled = function() {
	return !! (conf.ws && conf.ws.enabled && conf.ws.enableListeners && ! conf.redis.enabled);
};

// -------------------------------------------------------------

// 
// Start listening for an event to come in on the bus
// 
// @param {eventPattern} the event to listen for
// @param {func} the function to run
// @return void
// 
exports.on = function(eventPattern, func) {
	if (exports.enabled()) {
		if (! listeners[eventPattern]) {
			listeners[eventPattern] = [ ];
		}

		listeners[eventPattern].push({
			func: func
		});
	}
};

// 
// Start listening for an event to come in on the bus once
// 
// @param {eventPattern} the event to listen for
// @param {func} the function to run
// @return void
// 
exports.once = function(eventPattern, func) {
	if (exports.enabled()) {
		if (! listeners[eventPattern]) {
			listeners[eventPattern] = [ ];
		}

		listeners[eventPattern].push({
			func: func,
			once: true
		});
	}
};

// 
// Stop listening for an event to come in on the bus
// 
// @param {eventPattern} the event not to listen for
// @param {func} the function not to run
// @return void
// 
exports.off = function(eventPattern, func) {
	if (exports.enabled()) {
		var funcs = listeners[eventPattern];

		for (var i = 0; i < funcs.length; i++) {
			if (funcs.func === func) {
				funcs.splice(i--, 1);
			}
		}
	}
};

// 
// Emits an event on the bus
// 
// @param {event} the event to emit
// @param {data} any data to emit with the event
// @return void
// 
exports.emit = function(event, data) {
	Object.keys(listeners)
		.forEach(function(pattern) {
			if (! eventPatternCache[pattern]) {
				eventPatternCache[pattern] = minimatch.filter(pattern, options());
			}

			if (eventPatternCache[pattern](event)) {
				listeners[pattern].forEach(function(func) {
					func(data);
				});
			}
		});
};

// -------------------------------------------------------------

init();

function options() {
	return {
		nobrace: true,
		noglobstar: true
	};
}
