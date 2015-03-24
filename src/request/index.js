
var winston    = require('winston');
var Class      = require('../class');
var HttpError  = require('../http/error');

var Request = module.exports = Class.extend({

	init: function() {
		// 
	},

	// -------------------------------------------------------------
	
	// 
	// Set a response header
	// 
	setHeader: function(header, value) {
		throw new Error('Request::setHeader must be overwritten by inheriting class');
	},

	// 
	// Send a response
	// 
	send: function(status, meta, body) {
		throw new Error('Request::send must be overwritten by the inheriting class');
	},

	// 
	// 
	// 
	sendError: function(err) {
		HttpError.catch(this)(err);
	},

	// -------------------------------------------------------------

	// 
	// Log the request
	// 
	log: function() {
		winston.info(this.protocol.toUpperCase() + ' ' + this.method + ' ' + this.pathname);
	}

});
