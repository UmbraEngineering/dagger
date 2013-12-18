
var AppObject  = require('../app-object');
var merge      = require('merge-recursive');

var Server = module.exports = AppObject.extend({

	init: function(opts) {
		this._super();

		// Merge in any given options
		merge(this, opts || { });
	},

	listen: function(method, route, callback) {
		throw new Error('Server::listen must be extended by all subclasses');
	}

});
