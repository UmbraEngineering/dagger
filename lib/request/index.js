
var httpMeta   = require('../http-meta');
var AppObject  = require('../app-object');

var Request = module.exports = AppObject.extend({

	init: function(req, callback) {
		this._super();
	},

// -------------------------------------------------------------
	
	// 
	// Set a response header
	// 
	setHeader: function(header, value) {
		throw new Error('Request:setHeader must be overwritten by inheriting classes');
	},

	// 
	// Send a response
	// 
	respond: function(status, body) {
		throw new Error('Request::respond must be overwritten by inheriting classes');
	},

// --------------------------------------------------------
	
	// 
	// Log the request
	// 
	log: function() {
		logger.log('MESSAGE', this.protocol, this.method.toUpperCase(), this.url);

		logger.log('MESSAGE', '| User: ' + this.color(JSON.stringify(this.auth && this.auth.user._id)));
		logger.log('MESSAGE', '| Body: ' + this.color(JSON.stringify(this.body)));
		logger.log('MESSAGE', '| Headers:');
		this.logHeaders('|   ');
	},

	// 
	// Log the headers to the console
	// 
	logHeaders: function(prefix) {
		prefix = prefix || '';
		
		var self = this;
		var headers = this.requestHeaders;
		Object.keys(headers).forEach(function(header) {
			app.log('MESSAGE', prefix + self.color(header + ': ' + headers[header]));
		});
	},

	// 
	// Colors log output for {this.log}
	// 
	color: function() {
		var args = Array.prototype.slice.call(arguments);
		var message = args.join(' ');

		if (conf.logging.colorOutput) {
			message = logger.colored('debug', message);
		}

		return message;
	}

});
