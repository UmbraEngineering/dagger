
var AppObject = require('../app-object');

var Server = module.exports = AppObject.extend({

	secure: false,
	nonSecure: true,

	init: function() {
		this._super();
	},

	listen: function(method, route, callback) {
		throw new Error('Server::listen must be extended by all subclasses');
	}

});
