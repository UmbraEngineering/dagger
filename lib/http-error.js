
var HttpError = module.exports = function(status, error) {
	this.status = status;
	
	if (typeof error === 'string') {
		this.message = error;
	} else if (error) {
		this.message = error.message || error.toString();
	}
};

HttpError.prototype.send = function(req) {
	req.contentType('text/plain');
	req.send(this.status, this.message);
};
