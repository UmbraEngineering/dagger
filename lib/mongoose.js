
var when      = require('when');
var conf      = require('./conf');
var mongoose  = module.exports = require('mongoose');

// Open a new connection
mongoose.connect(conf.mongodb.url);

// 
// Extend when.js with a method to shim Document::save returning a promise
// 
when.saved = function(doc) {
	if (Array.isArray(doc)) {
		return when.all(doc.map(when.saved));
	}

	var deferred = when.defer();
	doc.save(function(err, doc) {
		if (err) {
			deferred.reject(err);
		}

		deferred.resolve(doc);
	});

	return deferred.promise;
};
