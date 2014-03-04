
var when      = require('when');
var conf      = require('./conf');
var mongoose  = require('mongoose');

// Patch mongoose-types bug (#17 and #21)
// @link {https://github.com/bnoguchi/mongoose-types/}
var bson = require(__dirname + '/../node_modules/mongoose/node_modules/mongodb/node_modules/bson');
mongoose.mongo.BinaryParser = bson.BinaryParser;

module.exports = mongoose;

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
