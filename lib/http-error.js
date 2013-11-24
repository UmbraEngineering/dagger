
var app = require('./index').app;

var HttpError = module.exports = function(status, error) {
	this.status = status;

	if (error instanceof Error) {
		error = {error: {
			name: error.name,
			code: error.code,
			message: error.message,
			stack: error.stack.split('\n').slice(1)
		}};
	}

	this.message = error;
};

HttpError.prototype.send = function(req) {
	try {
		req.send(this.status, this.message);
	} catch (e) {
		app.log('WARNING', 'Failed to send error to client in time.', this);
	}
};
