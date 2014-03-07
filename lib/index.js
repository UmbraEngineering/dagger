
exports = module.exports = function(opts) {
	return new exports.App(opts);
};

exports.require = function(module) {
	return require('./' + module);
};

exports.App = require('./app');
