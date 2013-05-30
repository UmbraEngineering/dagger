
exports.initialize = function(app) {
	
	Class('Request').Extends('AppObject', {

		// The applicable app.Resource instance
		resource: null,

		isHttp: false,
		isSocket: false,

		req: null,
		res: null,

		params: null,
		body: null,

		// This is an expressjs only property that I will likely never use, but that should probably be
		// made available anyway.
		next: null,

		// In the case of an authenticated request, this will contain a session object
		session: null,

	// -------------------------------------------------------------

		// 
		// Constructor
		// 
		construct: function(resource) {
			this.construct.parent(this);

			this.resource = resource;
		},

		// 
		// For HTTP requests, the app.Request class just acts as a middleman between Dagger and expressjs,
		// passing the necessary calls back and forth. We need to hold on to the appropriate data (req/res)
		// for when it is needed, but that's about it.
		// 
		initializeHttp: function(req, res, next) {
			this.req     = req;
			this.res     = res;
			this.isHttp  = true;
			this.params  = req.params;
			this.body    = req.body;
			this.method  = req.method.toLowerCase();
			this.next    = next;

			// 
			// TODO:
			//   - Authenticate if needed
			//   - Authorize if needed
			// 

			if (! this.resource[this.method]) {
				this.send405();
				return;
			}

			// Finally, call the appropriate method on the app.Resource instance
			this.resource[this.method](this);
		},

		// 
		// For socket requests, the request object is the exact data sent from the client. It should
		// look something like this:
		// 
		//   {
		//     "method":  "get",
		//     "url":     "/users/123",
		//     "body":    { ... }
		//   }
		// 
		// The response should look something like this:
		// 
		//   {
		//     "status":  200,
		//     "body":    { ... }
		//   }
		// 
		// The res variable is a callback for sending the response back to the client.
		// 
		initializeSocket: function(socket, req, params, res) {
			this.req       = req;
			this.res       = res;
			this.isSocket  = true;
			this.params    = params;
			this.body      = req.body;
			this.method    = req.method.toLowerCase();
			this.socket    = socket;
			this.session   = socket._daggerSession || null;

			// 
			// TODO:
			//   - Authenticate if needed
			//   - Authorize if needed
			// 

			if (! this.resource[this.method]) {
				this.sendError(405);
				return;
			}

			// Finally, call the appropriate method on the app.Resource instance
			this.resource[this.method](this);
		},

	// -------------------------------------------------------------

		// 
		// Login a user with credentials from this request creating a session.
		// 
		login: function(user, pass, callback) {
			if (! this.session) {
				this.session = new app.Session();
				if (this.socket) {
					this.socket._daggerSession = this.session;
				}
			}

			var session = this.session;
			session.initializeFromUsername(user, function(err) {
				if (err) {
					return callback(err);
				}

				session.authenticateCredentials(pass, function(err, passed, message) {
					if (err) {
						return callback(err);
					}

					if (passed) {
						session.create(function(err) {
							callback(err, true);
						});
					}

					else {
						callback(null, false, message);
					}
				});
			});
		},

		// 
		// This method will check if the request has valid authentication. This does not handle
		// authorization to access specific features or perform specific tasks, it merely tests
		// that valid credentials exist. When authentication is completed, the callback argument
		// will be called with a boolean argument representing if authentication passed.
		// 
		authenticate: function(callback) {
			// 
		},

		// 
		// This method is called if the client fails to pass a valid authentication token
		// 
		onAuthenticationFailure: function() {
			// 
		},

		// 
		// Test if the request is authorized
		// 
		authorize: function(callback) {
			var perms = this.resource.perms[this.method];
			
			if (! perms || ! perms.length) {
				return callback(null, true);
			}

			if (! this.session) {
				return callback(null, false, 'There is no valid session');
			}

			this.session.hasPermission(perms, function(err, passed, missing) {
				if (err) {
					return callback(err);
				}

				if (passed) {
					return callback(null, true);
				}

				callback(null, false, 'Failed to authorize because the following permissions were missing: ' + missing.join(', '));
			});
		},

	// -------------------------------------------------------------

		// 
		// Send a response to the request. For an HTTP request, this method works the same as the
		// expressjs method {res.send}. For a socket request, we emulate the expressjs behavior by
		// sending a JSON blob that will be interpreted client-side to have the same effect. Only
		// certain basic HTTP status codes are supported for socket responses.
		// 
		send: function(status, body) {
			if (this.isHttp) {
				this.res.send(status, body);
			}

			else if (this.isSocket) {
				if (arguments.length < 2) {
					body = status, status = void(0);
				}

				this.res({
					status: status || 200,
					body: body
				});
			}
		},

	// -------------------------------------------------------------

		// 
		// Generic error message data
		// 
		_errors: {
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
		},

		// 
		// This regex is used to parse error messages above for variables
		// 
		_errorMessageRegex: /%([a-zA-Z0-9]+)/g,

		// 
		// This method sends generic error messages
		// 
		sendError: function(status) {
			var self = this;
			return this.send(status, {
				error: this._errors[status].error,
				message: this._errors[status].message.replace(this._errorMessageRegex,
					function(match, $1) {return self.req[$1];}
				)
			});
		}

	});

};
