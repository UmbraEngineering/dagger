
var Server   = require('./base');
var conf     = require('../conf');
var express  = require('express');
var merge    = require('merge-recursive');

var ExpressServer = module.exports = Server.extend({

	init: function() {
		this._super();

		if (this.nonSecure) {
			this.http = express();
		}

		if (this.secure) {
			this.https = express();
		}
	},

	listen: function(method, route, opts, callback) {
		if (opts && ! callback) {
			callback = opts, opts = void(0);
		}

		opts = merge({ allowNonSecure: true, allowSecure: true }, opts || { });

		if (this.http && opts.allowNonSecure) {
			this.http[method](route, callback);
		}

		if (this.https && opts.allowSecure) {
			this.https[method](route, callback);
		}
	}

});
