
exports.initialize = function(app) {
	
	Class('Request').Extends('AppObject', {

		// The applicable app.Resource instance
		resource: null,

		isHttp: false,
		isSocket: false,

		req: null,
		res: null,

		params: null,

		// This is an expressjs only property that I will likely never use, but that should probably be
		// made available anyway.
		next: null,

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
			this.method  = req.method.toLowerCase();
			this.next    = next;

			// 
			// TODO:
			//   - Authenticate if needed
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
			this.method    = req.method.toLowerCase();

			// 
			// TODO:
			//   - Authenticate if needed (This will be the tricky part)
			// 

			if (! this.resource[this.method]) {
				this.send405();
				return;
			}

			// Finally, call the appropriate method on the app.Resource instance
			this.resource[this.method](this);
		},

	// -------------------------------------------------------------

		// 
		// TODO: I need to implement some sort of non-biased authentication system... blah :\
		// 
		authenticate: function() {
			// 
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
				return;
			}

			else if (this.isSocket) {
				if (arguments.length < 2) {
					body = status, status = void(0);
				}

				// 
			}
		},

		// 
		// Generic error message sending
		// 
		_errors: {
			405: {
				
			}
		},

		sendError: function(status) {
			return this.send(status, {
				error: this._errors[status].error,
				message: this._errors[status].message
			});
			return this.send(405, {
				error: 'Method Not Allowed',
				message: 'This resource does not support the ' + this.method.toUpperCase() + ' method'
			});
		}

	});

};
