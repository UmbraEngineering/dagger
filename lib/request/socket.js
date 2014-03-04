
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
		this.responseHeaders  = {
			'content-type': 'application/json'
		};
	},
	
	// 
	// Set a response header to be sent
	// 
	setHeader: function(header, value) {
		this.responseHeaders[header.toLowerCase()].push(value);
	},

	// 
	// Send a response
	// 
	respond: function(status, body) {
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
