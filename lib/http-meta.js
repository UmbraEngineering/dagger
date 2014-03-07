
var conf   = require('./conf');
var utils  = require('./utils');

// 
// A list of the allowed HTTP methods; anything else will be rejected
// with a 501 Not Implemented error
// 
exports.allowedMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

// 
// The same list of allowed methods as above, except these have been
// normallized into function names
// 
exports.methodFuncs = ['get', 'head', 'post', 'put', 'patch', 'delete', 'options'];

// 
// A list of the standardly supportted HTTP status codes and their names
// (and some non-standard ones)
// 
exports.statusCodes = {
	// 1xx
	100: 'Continue',
	101: 'Switching Protocols',
	102: 'Processing',
	103: 'Checkpoint',
	122: 'Request-URI Too Long',  // Non-standard (IE7 only)

	// 2xx
	200: 'OK',
	201: 'Created',
	202: 'Accepted',
	203: 'Non-Authoritative Information',
	204: 'No Content',
	205: 'Reset Content',
	206: 'Partial Content',
	207: 'Multi-Status',
	208: 'Not Reported',
	226: 'IM Used',

	// 3xx
	300: 'Multiple Choices',
	301: 'Moved Permanently',
	302: 'Found',
	303: 'See Other',
	304: 'Not Modified',
	305: 'Use Proxy',
	306: 'Switch Proxy',
	307: 'Temporary Redirect',
	308: 'Permanent Redirect',

	// 4xx
	400: 'Bad Request',
	401: 'Unauthorized',
	402: 'Payment Required',
	403: 'Forbidden',
	404: 'Not Found',
	405: 'Method Not Allowed',
	406: 'Not Acceptable',
	407: 'Proxy Authentication Required',
	408: 'Request Timeout',
	409: 'Conflict',
	410: 'Gone',
	411: 'Length Required',
	412: 'Precondition Failed',
	413: 'Request Entity Too Large',
	414: 'Request-URI Too Long',
	415: 'Unsupported Media Type',
	416: 'Request Range Not Satisfiable',
	417: 'Expectation Failed',
	418: 'I\'m a Teapot',
	419: 'Authentication Timeout',  // Non-Standard
	422: 'Unprocessable Entity',
	423: 'Locked',
	426: 'Upgrade Required',
	428: 'Precondition Required',
	429: 'Too Many Requests',
	431: 'Request Header Fields Too Large',
	451: 'Unavailable For Legal Reasons',  // Non-Standard

	// 5xx
	500: 'Internal Server Error',
	501: 'Not Implemented',
	502: 'Bad Gateway',
	503: 'Service Unavailable',
	504: 'Gateway Timeout',
	505: 'HTTP Version Not Supportted',
	506: 'Variant Also Negotiates',
	507: 'Insufficient Storage',
	508: 'Loop Detected',
	509: 'Bandwidth Limit Exceeded', // Non-Standard
	510: 'Not Extended',
	511: 'Network Authentication Required',
	522: 'Connection Timed Out'
};

// 
// Define an error class for HTTP errors
// 
var HttpError = exports.HttpError = function(status, message) {
	if (message instanceof HttpError) {
		return message;
	}

	if (arguments.length === 1) {
		message = status;
		status = 500;
	}

	// Handle mongoose validation errors
	if (message.name === 'ValidationError') {
		this.message = message.errors;
		this.status = 400;
		this.description = exports.statusCodes[400];
	}

	// If we were given an error object
	else if (message instanceof Error) {
		Error.call(this, message.message);
		this.message = message.message;
		this.stack = message.stack || Error.getStackTrace();
		this.status = status;
		this.description = exports.statusCodes[status];
	}

	// If we were just given a string message
	else {
		Error.call(this, message);
		this.message = message;
		this.stack = Error.getStackTrace();
		this.status = status;
		this.description = exports.statusCodes[status];
	}
};

require('util').inherits(HttpError, Error);

HttpError.prototype.name = 'HttpError';

HttpError.prototype.toJSON = function() {
	var body = { message: this.message };

	if (conf.output.errorStacks) {
		body.stack = this.stack ? null : Error.getStackTrace({
			stack: this.stack,
			split: true
		});
	}

	return {
		meta: {
			status: this.status,
			description: this.description
		},
		body: body
	};
};

HttpError.prototype.send = function(req) {
	req.respond(this.status, this.toJSON());
};
