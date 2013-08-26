
var HttpError = module.exports = function(status, error) {
	this.status = status;
	this.message = error;
};

HttpError.prototype.send = function(req) {
	req.contentType('text/plain');
	req.send(this.status, this.message);
};
