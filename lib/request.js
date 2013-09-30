
var oath    = require('oath');
var app     = require('./index').app;
var logger  = require('./logger');

// -------------------------------------------------------------

// Add the built-in auth-related models to the registry
app.models._registerModelDirectory(__dirname + '/models');

var AuthToken; app.models.require('auth-tokens').resolve(function(Model) {
	AuthToken = Model;
});

// Load the user model (defined by project, not in dagger.js)
var User = app.models.require(app.conf.auth.userModel)();
var Session = require('./session').Session;

// Load the test password function defined in config
var testPassword = app.conf.auth.testPassword;

// -------------------------------------------------------------

// 
// Define the Request class
// 
var Request = exports.Request = function(resource) {
	// The applicable app.Resource instance
	this.resource = resource;

	// Define the type of request
	this.isHttp    = false;
	this.isSocket  = false;

	// The original req/res objects
	this.req  = null;
	this.res  = null;

	// Request data
	this.body    = null;
	this.query   = null;
	this.params  = null;

	// This is an expressjs only property that I will likely never use, but that should probably be
	// made available anyway.
	this.next = null;

	// In the case of an authenticated request, this will contain an AuthToken instance
	this.auth = null;

	// Where we store headers for socket connections
	this._headers = [ ];
};

// -------------------------------------------------------------

Request.create = function(resource) {
	return new Request(resource);
};

// -------------------------------------------------------------

// 
// For HTTP requests, the app.Request class just acts as a middleman between Dagger and expressjs,
// passing the necessary calls back and forth. We need to hold on to the appropriate data (req/res)
// for when it is needed, but that's about it.
// 
Request.prototype.initializeHttp = function(req, res, next) {
	this.req       = req;
	this.res       = res;
	this.isHttp    = true;
	this.url       = req.url;
	this.params    = req.params;
	this.query     = req.query;
	this.protocol  = req.protocol.toUpperCase();
	this.headers   = req.headers;
	this.body      = req.body;
	this.method    = req.method.toLowerCase();
	this._method   = this.method === 'delete' ? 'del' : this.method;
	this.next      = next;

	if (! app.conf.auth.enabled) {
		this.startRequest(); return;
	}

	var self = this;
	this.authenticate().then(
		function() {
			self.startRequest();
		},
		function(err) {
			if (! (err instanceof app.Resource.HttpError)) {
				err = new app.Resource.HttpError(500, err);
			}

			err.send(self);
		});
};

// -------------------------------------------------------------

// 
// For socket requests, the request object is the exact data sent from the client. It should
// look something like this:
// 
//   {
//     "method":   "get",
//     "url":      "/users/123",
//     "headers":  [ ... ],
//     "body":     { ... }
//   }
// 
// The response should look something like this:
// 
//   {
//     "status":   200,
//     "body":     { ... },
//     "headers":  [ ... ]
//   }
// 
// The res variable is a callback for sending the response back to the client.
// 
Request.prototype.initializeSocket = function(socket, req, params, query, res) {
	this.req       = req;
	this.res       = res;
	this.isSocket  = true;
	this.url       = req.url;
	this.params    = params;
	this.query     = query;
	this.protocol  = 'SOCKET';
	this.headers   = req.headers;
	this.body      = req.body;
	this.method    = req.method.toLowerCase();
	this._method   = this.method === 'delete' ? 'del' : this.method;
	this.socket    = socket;
	this.session   = socket._daggerSession || null;

	if (! app.conf.auth.enabled) {
		this.startRequest(); return;
	}

	var self = this;
	this.authenticate().then(
		function() {
			self.startRequest();
		},
		function(err) {
			if (! (err instanceof app.Resource.HttpError)) {
				err = new app.Resource.HttpError(500, err);
			}

			err.send(self);
		});
};

// -------------------------------------------------------------

Request.prototype.param = function(param) {
	return this.params[param];
};

// -------------------------------------------------------------

Request.prototype.startRequest = function() {
	var self = this;

	this.log();

	if (! this.resource[this._method]) {
		return this.sendError(405);
	}

	if (! app.conf.auth.enabled) {
		this.resource[this._method](this); return;
	}

	this.resource.authorize(this).then(
		function(authResult) {
			if (authResult !== true) {
				return self.sendError(authResult);
			}

			self.resource[self._method](self);
		},
		function(err) {
			if (! (err instanceof app.Resource.HttpError)) {
				err = new app.Resource.HttpError(500, err);
			}

			err.send(self);
		});
};

// -------------------------------------------------------------

Request.prototype.color = function() {
	var args = Array.prototype.slice.call(arguments);
	var message = args.join(' ');

	if (app.conf.logging.colorOutput) {
		message = logger.colored('debug', message);
	}

	return message;
}

Request.prototype.logHeaders = function(prefix) {
	var self = this;
	var prefix = prefix || '';
	var headers = self.headers;
	
	Object.keys(headers).forEach(function(header) {
		app.log('MESSAGE', prefix + self.color(header + ': ' + headers[header]));
	});
};

Request.prototype.log = function() {
	app.log('MESSAGE', this.protocol, this.method.toUpperCase(), this.url);

	app.log('MESSAGE', '| User: ' + this.color(JSON.stringify(this.auth && this.auth.user._id)));
	app.log('MESSAGE', '| Body: ' + this.color(JSON.stringify(this.body)));
	app.log('MESSAGE', '| Headers:');
	this.logHeaders('|   ');
};

// -------------------------------------------------------------

// 
// This method will check if the request has valid authentication. This does not handle
// authorization to access specific features or perform specific tasks, it merely tests that
// valid credentials exist and stores auth/user data on the request object if successful.
// 
Request.prototype.authenticate = function() {
	var self = this;
	var conf = app.conf.auth;
	var promise = new oath();

	process.nextTick(function() {
		// Find the auth token
		var token;
		if (conf.allowAuthTokenHeaders) {
			token = self.req.headers[conf.authTokenHeader];
		}
		if (conf.allowAuthTokenParams) {
			token = self.req.query[conf.authTokenParam] || token;
		}

		// If there is no token given, just move on unauthenticated
		if (! token) {
			return promise.resolve(false);
		}

		// Look up the token (with the user model populated)
		AuthToken.findOne({token: token}, function(err, token) {
			if (err) {
				return promise.reject(err);
			}

			if (! token) {
				return promise.reject(
					new app.Resource.HttpError(401, 'Authentication failure: authentication token does not exist')
				);
			}

			// Start building the auth object for this request
			self.auth = new Session();
			self.auth.initializeFromToken(token).then(
				promise.resolve.bind(promise),
				function(err) {
					if (! (err instanceof app.Resource.HttpError)) {
						err = new app.Resource.HttpError(500, err);
					}
					promise.reject(err);
				});
		});
	});

	return promise.promise;
};

// -------------------------------------------------------------

Request.prototype.setHeader = function(header, value) {
	if (this.isHttp) {
		this.res.setHeader(header, value);
	}

	else if (this.isSocket) {
		this._headers.push([header, value]);
	}
};

// -------------------------------------------------------------

// 
// Sets the content-type to be used in the case of an HTTP request. If the request was made
// by socket, this value will be sent as meta-data.
// 
Request.prototype.contentType = function(value) {
	this.setHeader('Content-Type', value);
};

// -------------------------------------------------------------

// 
// Send a response to the request. For an HTTP request, this method works the same as the
// expressjs method {res.send}. For a socket request, we emulate the expressjs behavior by
// sending a JSON blob that will be interpreted client-side to have the same effect. Only
// certain basic HTTP status codes are supported for socket responses.
// 
Request.prototype.send = function(status, body) {
	// If we are responding to a HEAD request, do not send a response body
	if (this.method === 'head') {body = '';}

	if (this.isHttp) {
		this.res.send(status, body);
	}

	else if (this.isSocket) {
		if (arguments.length < 2) {
			body = status, status = void(0);
		}

		this.res({
			status: status || 200,
			headers: this._headers,
			body: body
		});
	}
};

// -------------------------------------------------------------

// 
// Generic error message data
// 
Request.prototype._errors = {
	400: {
		error: 'Bad Request',
		message: 'The request cannot be fulfilled due to bad syntax'
	},
	401: {
		error: 'Unauthorized',
		message: 'You are not authorized to access the requested resource'
	},
	404: {
		error: 'Not Found',
		message: 'The requested resource was not found'
	},
	405: {
		error: 'Method Not Allowed',
		message: 'This resource does not support the "%method" method'
	}
};

// -------------------------------------------------------------

// 
// This regex is used to parse error messages above for variables
// 
Request.prototype._errorMessageRegex = /%([a-zA-Z0-9]+)/g;

// -------------------------------------------------------------

// 
// This method sends generic error messages
// 
Request.prototype.sendError = function(status, message) {
	var self = this;

	// Set the Allow header for 405 requests
	if (status === 405) {
		this.setHeader('Allow', this.resource.allow().join(', '));
	}
	
	return this.send(status, {
		name: this._errors[status].error,
		message: this._errors[status].message.replace(this._errorMessageRegex,
			function(match, $1) {return self.req[$1];}
		)
	});
};
