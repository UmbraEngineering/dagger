
// Load in the needed promise extensions
require('promise-extensions')
	.init(require('promise-es6').Promise)
	.install('while');

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
	exports.app = new App(options);
	exports.app.setup();
	return exports.app;
};

// 
// Load dependencies
// 
var App       = require('./app');
var Endpoint  = require('./endpoint');
var winston   = require('winston');
var config    = require('./config');

// 
// Expose and configure the logger
// 
var loggerConf = config.logging || { enabled: true };
exports.logger = winston;
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
	silent: ! loggerConf.enabled,
	colorize: loggerConf.colors,
	level: loggerConf.level,
	timestamp: loggerConf.timestamp
});

// 
// Expose the endpoint class/method
// 
exports.Endpoint = Endpoint;
exports.endpoint = function(baseUrl, routes) {
	return new Endpoint(baseUrl, routes);
};

// 
// Expose HttpError
// 
exports.HttpError = require('./http/error');

// 
// Expose the base authorization schemes
// 
exports.auth = {
	Authorization: require('./model/authorization'),
	AllowAllAuthorization: require('./model/authorization/allow-all'),
	DenyAllAuthorization: require('./model/authorization/deny-all')
};
