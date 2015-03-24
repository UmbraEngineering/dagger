
var httpMeta  = require('./meta');
var conf      = require('../config');

// Used to parse dupe key errors
var dupeKeyError = /duplicate key error index: (.+) dup key/;

// 
// Define an error class for HTTP errors
// 
// @param {status} the HTTP status code for the error
// @param {message} the error message
// 
var HttpError = module.exports = function(status, message) {
	if (message instanceof HttpError) {
		return message;
	}

	if (arguments.length === 1) {
		message = status;
		status = 500;
	}

	// This means that the param ID was not a valid ObjectId
	if (message.name === 'CastError' || message.path === '_id') {
		this.message = 'Invalid document ID';
		this.status = 400;
		this.description = httpMeta.statusCodes[400];
	}

	// Handle mongoose validation errors
	else if (message.name === 'ValidationError') {
		this.message = message.errors;
		this.status = 400;
		this.description = httpMeta.statusCodes[400];
	}

	// If we were given an error object
	else if (message instanceof Error) {
		Error.call(this, message.message);
		this.message = message.message;
		this.stack = message.stack || getStackTrace();
		this.status = status;
		this.description = httpMeta.statusCodes[status];
	}

	// If we were just given a string message
	else {
		Error.call(this, message);
		this.message = message;
		this.stack = getStackTrace();
		this.status = status;
		this.description = httpMeta.statusCodes[status];
	}

	// Handle errors for duplicate unique keys
	var dupeKeyMatch = dupeKeyError.exec(this.message);
	if (dupeKeyMatch) {
		dupeKeyMatch = dupeKeyMatch[1].split('.');

		this.status = 400;
		this.description = httpMeta.statusCodes[400];
		this.message = 'The ' + dupeKeyMatch[1] + ' field "' + dupeKeyMatch[2].slice(1, -3) +
			'" must be unique. The value given already exists.';
	}
};

// 
// Returns a function that takes an error as a parameter and sends an error
// response to a request
// 
// @param {req} the request that will be responded to
// @return function
// 
HttpError.catch = function(req) {
	return function(err) {
		err = (err instanceof HttpError) ? err : new HttpError(err);
		err.send(req);
	};
};

// 
// Inherit from `Error`
// 
require('util').inherits(HttpError, Error);

// 
// Set the `name` value to identify this as an HttpError
// 
HttpError.prototype.name = 'HttpError';

// 
// Converts the error into a JSON-able object (because you can't stringify
// Errors by default)
// 
// @return object
// 
HttpError.prototype.toJSON = function() {
	var result = { error: this.message };

	if (conf.output && conf.output.errorStacks) {
		result.stack = this.stack ? getStackTrace({
			stack: this.stack,
			split: true
		}) : null;
	}

	return result;
};

// 
// Send the error to as a response
// 
// @param {req} the request object to respond to
// @return void
// 
HttpError.prototype.send = function(req) {
	req.send(this.status, {message: this.description}, this.toJSON());
};

// 
// Get a stack trace
// 
function getStackTrace(opts) {
	opts = opts || { };

	var stack = opts.stack;

	if (! stack) {
		try {
			throw new Error();
		} catch (err) {
			stack = err.stack;
		}
	}

	if (opts.split) {
		stack = stack.split('\n').slice(1).map(function(str) {
			return str.trim();
		});
	}

	return stack;
}
