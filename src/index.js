
var App       = require('./app');
var Endpoint  = require('./endpoint');

// 
// The method which creates and starts up the app server
// 
// @param {options} additional options
// @return object
// 
exports = module.exports = function(options) {
	return exports.app = new App(options);
};

// 
// Expose the endpoint class/method
// 
exports.Endpoint = Endpoint;
exports.endpoint = function(baseUrl, routes) {
	return new Endpoint(baseUrl, routes);
};

// 
// Expose the base authorization schemes
// 
exports.auth = {
	Authorization: require('./model/authorization'),
	AllowAllAuthorization: require('./model/authorization/allow-all'),
	DenyAllAuthorization: require('./model/authorization/deny-all')
};





