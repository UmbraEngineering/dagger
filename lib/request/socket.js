
var url       = require('url');
var Request   = require('./index');
var httpMeta  = require('../http-meta');

var SocketRequest = module.exports = Request.extend({

	init: function(socket, req, callback) {
		this._super();

		var parsedUrl = url.parse(req.url, true);

		this.protocol         = 'WS';
		this.socket           = socket;
		this.req              = req;
		this.pathname         = parsedUrl.pathname;
		this.query            = parsedUrl.query;
		this.callback         = callback;
		this.method           = req.method.toUpperCase();
		this.requestHeaders   = req.headers || [ ];
		this.body             = req.body;
		this.responseHeaders  = {
			'content-type': 'application/json'
		};

		this.requestHeaders = this.requestHeaders.reduce(function(memo, header) {
			memo[header[0].toLowerCase()] = header[1];
			return memo;
		}, { });

		this.log();
	},
	
	// 
	// Set a response header to be sent
	// 
	setHeader: function(header, value) {
		if (Array.isArray(header)) {
			return this.setHeader(header[0], header[1]);
		}
		this.responseHeaders[header.toLowerCase()] = value;
	},

	// 
	// Send a response
	// 
	respond: function(status, meta, body) {
		if (arguments.length < 3) {
			body = meta;
			meta = null;
		}

		if (meta) {
			if (meta.status) {
				status = meta.status;
			}

			if (meta.headers) {
				meta.headers.forEach(this.setHeader.bind(this));
			}
		}

		return this.sendResponse(status, this.getResponseHeaders(), body);
	},

	// 
	// Actually responds, calling the callback
	// 
	sendResponse: function(status, headers, body) {
		this.callback({
			status: status,
			message: httpMeta.statusCodes[status],
			headers: headers,
			body: body
		});
	},

	// 
	// Get a formatted array of response headers
	// 
	getResponseHeaders: function() {
		var result = [ ];
		var headers = this.responseHeaders;

		Object.keys(headers).forEach(function(header) {
			if (! Array.isArray(headers[header])) {
				return result.push([ header, headers[header] ]);
			}

			headers[header].forEach(function(value) {
				result.push([ header, value ]);
			});
		});

		return result;
	}

});
