
var App       = require('./app');
var Engpoint  = require('./endpoint');

exports = module.exports = function(config) {
	exports.app = new App(config);
};

exports.endpoint = function(def) {
	// 
};
