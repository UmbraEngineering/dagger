
var httpMeta = require('./meta');

// Used to parse dupe key errors
var dupeKeyError = /duplicate key error index: (.+) dup key/;

// 
// Define an error class for HTTP errors
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
		this.stack = message.stack || Error.getStackTrace();
		this.status = status;
		this.description = httpMeta.statusCodes[status];
	}

	// If we were just given a string message
	else {
		Error.call(this, message);
		this.message = message;
		this.stack = Error.getStackTrace();
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

HttpError.catch = function(req) {
	return function(err) {
		err = (err instanceof HttpError) ? err : new HttpError(err);
		err.send(req);
	};
};

require('util').inherits(HttpError, Error);

HttpError.prototype.name = 'HttpError';

HttpError.prototype.toJSON = function() {
	var result = { message: this.message };

	if (conf.output.errorStacks) {
		result.stack = this.stack ? Error.getStackTrace({
			stack: this.stack,
			split: true
		}) : null;
	}

	return result;
};

HttpError.prototype.send = function(req) {
	req.respond(this.status, {message: this.description}, this.toJSON());
};
