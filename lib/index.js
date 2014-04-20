
exports = module.exports = function(opts) {
	return new exports.App(opts);
};

exports.App = require('./app');
