
var Request   = require('./index');
var httpMeta  = require('../http-meta');
var merge     = require('merge-recursive');

var HttpRequest = module.exports = Request.extend({

	init: function(req, res, next) {
		this._super();

		this.protocol         = 'HTTP';
		this.req              = req;
		this.res              = res;
		this.next             = next;
		this.pathname         = req.pathname;
		this.query            = req.query;
		this.params           = req.params;
		this.requestHeaders   = req.headers || [ ];
		this.method           = req.method.toUpperCase();
	},

	setHeader: function(header, value) {
		return this.res.setHeader(header, value);
	},

	respond: function(status, meta, body) {
		var res = this.res;

		if (arguments.length < 3) {
			body = meta;
			meta = { };
		}

		// This should rarely if ever happen
		if (this.res.getHeader('content-type') !== 'application/json') {
			return res.send(status, body);
		}

		res.json(status, {
			meta: merge({
				status: status,
				message: httpMeta.statusCodes[status]
			}, meta),
			body: body
		});
	}

});
