
var util          = require('util');
var conf          = require('./conf');
var Class         = require('./class');
var merge         = require('merge-recursive');
var EventEmitter  = require('eventemitter2').EventEmitter2;

// 
// AppObject class
// 
var AppObject = module.exports = Class.extend(EventEmitter, {
	
	init: function() {
		EventEmitter.call(this, conf.ee2);
	},

	// 
	// Bind a method(s) to the scope of this object
	// 
	//   this.bind('foo')  <===>  this.foo = this.foo.bind(this);
	// 
	bind: function() {
		for (var i = 0, c = arguments.length; i < c; i++) {
			this[arguments[i]] = this[arguments[i]].bind(this);
		}
	},

	// 
	// An addition to EventEmitter2, this is basically just a partial application
	// method for emit
	// 
	emits: function() {
		var args = [this].concat(Array.prototype.slice.call(arguments));
		return this.emit.bind.apply(this.emit, args);
	},

	// 
	// An addition to EventEmitter2, this method allows reemitting an event from
	// a different source
	// 
	reemit: function(event) {
		var self = this;
		return function() {
			event = event || this.event;
			if (event.charAt(0) === '.') {
				event = this.event + event;
			} else if (event.charAt(event.length - 1) === '.') {
				event += this.event;
			}
			
			var args = [ event ];
			args.push.apply(args, arguments);
			self.emit.apply(self, args);
		};
	}

});
