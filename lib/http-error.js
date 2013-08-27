
var HttpError = module.exports = function(status, error) {
	this.status = status;

	if (error instanceof Error) {
		error = {error: {
			name: error.name,
			message: error.message,
			stack: error.stack.split('\n').slice(1)
		}};
	}

	this.message = error;
};

HttpError.prototype.send = function(req) {
	req.contentType('text/plain');
	req.send(this.status, this.message);
};
