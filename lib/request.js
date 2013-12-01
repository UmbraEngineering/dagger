
var when       = require('when');
var mime       = require('mime');
var conf       = require('./conf');
var logger     = require('./logger');
var AppObject  = require('./app-object');
var HttpError  = require('./http-meta').HttpError;

// 
// Define the Request class
// 
var Request = module.exports = AppObject.extend({

	// The applicable resource object
	resource: null,

	// What type of request is this
	isHttp: false,
	isSocket: false,

	// If HTTP, these are the req/res objects from the HTTP server;
	// If Socket, these are the payload and callback for the socket request
	req: null,
	res: null,

	// Request data objects
	body: null,
	query: null,
	params: null,

	// This is the {next} function given by Express, onyl available for HTTP
	// requests
	next: null,

	// In the case of an authenticated request, this is the AuthEntity instance
	// for the current user
	auth: null,

	// Response headers to be sent
	responseHeaders: null,

// --------------------------------------------------------
	
	init: function() {
		this._super();
	},

	// 
	// Initializes the request object for HTTP requests
	// 
	initHttp: function(req, res, next) {
		this.req         = req;
		this.res         = res;
		this.next        = next;
		this.isHttp      = true;
		this.url         = req.url;
		this.params      = req.params;
		this.query       = req.query;
		this.protocol    = req.protocol.toLowerCase();
		this.headers     = req.headers;
		this.body        = req.body;
		this.method      = req.method.toUpperCase();
		this.methodFunc  = (this.method === 'DELETE') ? 'del' : this.method.toLowerCase();
	},

	// 
	// Initialize the request object for Socket requets
	// 
	initSocket: function(socket, req, params, query, res) {
		this.req               = req;
		this.res               = res;
		this.isSocket          = true;
		this.url               = req.url;
		this.params            = req.params;
		this.query             = req.query;
		this.protocol          = ();
		this.headers           = req.headers;
		this.body              = req.body;
		this.method            = req.method.toUpperCase();
		this.methodFunc        = (this.method === 'DELETE') ? 'del' : this.method.toLowerCase();
		this.socket            = socket;
		this.auth              = socket._daggerSession || null;
		this._responseHeaders  = [ ];
	},

// --------------------------------------------------------
	
	// 
	// Authenticates the request (does not authorize)
	// 
	authenticate: function() {
		var token;
		var deferred = when.defer();

		// Get any auth token that was sent
		if (conf.allowAuthTokenHeaders) {
			token = this.headers[conf.authTokenHeader];
		}
		if (conf.allowAuthTokenParams) {
			token = token || this.query[conf.authTokenParam];
		}

		// If there was no token given by the client, stop now, we cannot authenticate
		if (! token) {
			return when.resolve(false);
		}

		// If there is already a session, just refresh it
		if (this.auth) {
			if (this.auth.token.token === token) {
				return when.resolve(this.auth.refresh());
			}
			this.auth = null;
		}

		// Look up the AuthToken in mongo
		AuthToken.findOne({ token: token }, function(err, token) {
			if (err) {
				return deferred.reject(err);
			}

			// If the given token is bad (not in the db), fail the authentication
			if (! token) {
				return deferred.reject(new HttpError(401, 'Invalid authentication token'));
			}

			// Build the session object
			this.auth = new Session();
			this.auth.initFromToken(token).then(
				function() {
					deferred.resolve(true);
				},
				function(err) {
					deferred.reject(new HttpError(401, err));
				});
		}.bind(this));

		return deferred.promise;
	},

// --------------------------------------------------------
	
	// 
	// Set a new response header
	// 
	setHeader: function(header, value) {
		if (this.isHttp) {
			this.res.setHeader(header, value);
		}

		else if (this.isSocket) {
			this._responseHeaders.push([header, value]);
		}
	},

	// 
	// Shortcut for setting the content type of the response
	// 
	contentType: function(type) {
		if (type[0] === '.') {
			type = mime.lookup(type);
		}

		this.setHeader('Content-Type', type);
		
		return type;
	},

// --------------------------------------------------------
	
	// 
	// Send a response
	// 
	send: function(status, body) {
		// Do not allow sending response bodies to HEAD requests
		if (this.method === 'HEAD') {body = '';}

		// If this is an HTTP request, we can just use Express' send method
		if (this.isHttp) {
			this.res.send(status, body);
		}

		// If this is a socket request, we need to build the response ourselves
		else if (this.isSocket) {
			if (arguments.length < 2 && typeof status !== 'number') {
				body = status, status = 200;
			}

			this.res({
				status: status,
				headers: this._responseHeaders,
				body: body
			});
		}
	},

// --------------------------------------------------------
	
	// 
	// Logs the request
	// 
	log: function() {
		logger.log('MESSAGE', this.protocol, this.method.toUpperCase(), this.url);

		logger.log('MESSAGE', '| User: ' + this.color(JSON.stringify(this.auth && this.auth.user._id)));
		logger.log('MESSAGE', '| Body: ' + this.color(JSON.stringify(this.body)));
		logger.log('MESSAGE', '| Headers:');
		this.logHeaders('|   ');
	},

	// 
	// Log the headers to the console
	// 
	logHeaders: function(prefix) {
		prefix = prefix || '';
		
		Object.keys(this.headers).forEach(function(header) {
			app.log('MESSAGE', prefix + this.color(header + ': ' + this.headers[header]));
		}.bind(this));
	},

	// 
	// Colors log output for {this.log}
	// 
	color: function() {
		var args = Array.prototype.slice.call(arguments);
		var message = args.join(' ');

		if (conf.logging.colorOutput) {
			message = logger.colored('debug', message);
		}

		return message;
	}

});

// --------------------------------------------------------

Request.create = function() {
	return new Request();
};
