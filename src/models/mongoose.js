
var conf      = require('../config');
var winston   = require('winston');
var mongoose  = module.exports = require('mongoose');

// Open a new connection
mongoose.connect(conf.mongodb.url);

// Add support for #catch on mongoose promises
// See: https://github.com/aheckmann/mpromise/pull/14#issuecomment-68448406
try {
	var MPromise  = require('mongoose/node_modules/mpromise');
	MPromise.prototype.catch = function(onReject) {
		return this.then(null, onReject);
	};
} catch (err) {
	// pass - Put this here so that if/when mongoose stops using mpromise,
	// this require doesn't start throwing errors and crashing servers, but
	// hopefully someone will report the warning and this can be updated ... :p
	winston.warn('Failed to resolve `mongoose/node_modules/mpromise` to patch #catch.');
}
