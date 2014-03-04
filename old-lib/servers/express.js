
var conf     = require('../conf');
var express  = require('express');
var merge    = require('merge-recursive');
var servers  = require('./index');

var ExpressServer = module.exports = servers.Server.extend({

	init: function(opts) {
		this._super(opts);

		this.express = express();

		if (servers.http) {
			servers.on('http', this.express);
		}

		if (servers.https) {
			servers.on('https', this.express);
		}
	},

	listen: function(method, route, callback) {
		this.express[method](route, callback);
	}

});
