
var url       = require('url');
var Request   = require('./index');
var httpMeta  = require('../http/meta');
var qs        = require('querystring');
var Promise   = require('promise-es6').Promise;

var HttpRequest = module.exports = Request.extend({

	// 
	// @param {socket} the socket the request was made on
	// @param {req} the request object
	// @param {callback} the response callback
	// 
	init: function(socket, req, callback) {
		this._socket    = socket;
		this._req       = req;
		this._callback  = callback;

		this.protocol         = 'ws';
		this.url              = url.parse(req.url, true);
		this.pathname         = this.url.pathname;
		this.query            = this.url.query;
		this.requestHeaders   = req.headers || [ ];
		this.method           = req.method.toUpperCase();
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
	// Set a new response header
	// 
	// @param {header} the header to set
	// @param {value} the new value to set the header to
	// @return void
	// 
	setHeader: function(header, value) {
		if (Array.isArray(header)) {
			return this.setHeader(header[0], header[1]);
		}
		this.responseHeaders[header.toLowerCase()] = value;
	},

	// 
	// Send a response to the client
	// 
	// @param {status} the HTTP status code
	// @param {meta} an object containing meta data about the response
	// @param {body} the response body content
	// @return void
	// 
	send: function(status, meta, body) {
		if (arguments.length < 3) {
			body = meta;
			meta = { };
		}

		this._respond(status, this.getResponseHeaders(), body);
	},

	// 
	// The low-level function that actually sends a response to the request
	// 
	// @param {status} the status code
	// @param {headers} the headers
	// @param {body} the response body
	// @return void
	// 
	_respond: function(status, headers, body) {
		this._callback({
			status: status,
			message: httpMeta.statusCode[status],
			headers: headers,
			body: body
		});
	},

	// -------------------------------------------------------------

	// 
	// Get a formatted array of response headers
	// 
	// @return array
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
