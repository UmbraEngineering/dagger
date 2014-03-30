
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
		this.pathname         = req.url;
		this.query            = req.query;
		this.params           = req.params;
		this.requestHeaders   = req.headers || [ ];
		this.method           = req.method.toUpperCase();
		this.body             = req.body;

		this.log();
	},

	setHeader: function(header, value) {
		return this.res.setHeader(header, value);
	},

	respond: function(status, meta, body) {
		if (arguments.length < 3) {
			body = meta;
			meta = { };
		}

		// This should rarely if ever happen
		var type = this.res.getHeader('content-type');
		if (type && type !== 'application/json') {
			return this.res.send(status, body);
		}

		this.res.json(status, {
			meta: merge({
				status: status,
				message: httpMeta.statusCodes[status]
			}, meta),
			body: body
		});
	}

});
