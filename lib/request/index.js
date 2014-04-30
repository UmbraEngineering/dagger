
var conf       = require('../conf');
var logger     = require('../logger');
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

	// 
	// Send a redirect response
	// 
	redirect: function(status, location) {
		if (arguments.length === 1) {
			location = status;
			status = null;
		}
		
		status = status || 303;

		this.setHeader('Location', location);
		this.respond(status);
	},

// --------------------------------------------------------
	
	// 
	// Log the request
	// 
	log: function() {
		if (conf.logging.requests && conf.logging.requests.enabled) {
			logger.message([this.protocol, this.method.toUpperCase(), this.pathname].join(' '));

			if (conf.logging.requests.body) {
				logger.message('| Body: ' + this.color(JSON.stringify(this.body)));
			}
			
			if (conf.logging.requests.headers) {
				logger.message('| Headers:');
				this.logHeaders('|   ');
			}
		}
	},

	// 
	// Log the headers to the console
	// 
	logHeaders: function(prefix) {
		prefix = prefix || '';
		
		var self = this;
		var headers = this.requestHeaders;
		Object.keys(headers).forEach(function(header) {
			logger.message(prefix + self.color(header + ': ' + headers[header]));
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
