
var url       = require('url');
var Request   = require('./index');
var dagger    = require('../index');
var httpMeta  = require('../http/meta');
var qs        = require('querystring');
var merge     = require('merge-recursive');
var Promise   = require('promise-es6').Promise;

var HttpRequest = module.exports = Request.extend({

	// 
	// @param {req} the request object
	// @param {res} the response object
	// 
	init: function(req, res) {
		this._req = req;
		this._res = res;

		this.protocol         = isHttps() ? 'https' : 'http';
		this.url              = url.parse(req.url, true);
		this.pathname         = this.url.pathname;
		this.query            = this.url.query;
		this.requestHeaders   = req.headers || [ ];
		this.method           = req.method.toUpperCase();

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
		return this.res.setHeader(header, value);
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

		var res = this._res;
		var result = {
			meta: merge({
				status: status,
				message: httpMeta.statusCodes[status]
			}, meta),
			body: body
		};

		res.status = status;
		res.setHeader('Content-Type', 'application/json');
		res.write(JSON.stringify(result));
		res.end();
	},

	// -------------------------------------------------------------

	// 
	// Waits for the request body to come in, building up the complete message
	// in a buffer. Once the whole message is recieved, attempts to parse the
	// request body as either JSON or querystring formatted data.
	// 
	// @return promise
	// 
	getRequestBody: function() {
		var body  = '';
		var self  = this;
		var req   = this._req;

		return new Promise(function(resolve, reject) {
			req.on('data', function(chunk) {
				body += chunk;

				// Avoid potential flooding; Kill any request that is too big
				if (body.length > (conf.http.maxIncoming || 1e6)) {
					req.pause();
					reject(new HttpError(413, 'Request body was too large'));
				}
			});

			req.on('end', function() {
				try {
					switch (self.requestHeaders['content-type']) {
						case 'application/x-www-form-urlencoded':
							return resolve(self.body = qs.parse(body));
						case 'application/json':
							return resolve(self.body = JSON.parse(body));
					}
				} catch (err) { /* pass */ }

				return resolve(self.body = body);
			});
		});
	}

});

// -------------------------------------------------------------

function isHttps() {
	return dagger.app.httpServer.isHttps;
}
