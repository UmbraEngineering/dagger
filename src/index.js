
// 
// The method which creates and starts up the app server
// 
// This has to run before the `require` calls to make sure that
// `module.exports` has been correctly replace *before* those modules
// try to load it themselves.
// 
// @param {options} additional options
// @return object
// 
exports = module.exports = function(options) {
	return exports.app = new App(options);
};

// 
// Load dependencies
// 
var App       = require('./app');
var Endpoint  = require('./endpoint');

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





