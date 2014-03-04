
var when      = require('when');
var conf      = require('./conf');
var mongoose  = require('mongoose');

// Patch mongoose-types bug (#17 and #21)
// @link {https://github.com/bnoguchi/mongoose-types/}
var bson = require(__dirname + '/../node_modules/mongoose/node_modules/mongodb/node_modules/bson');
mongoose.mongo.BinaryParser = bson.BinaryParser;

module.exports = mongoose;

mongoose.connect(conf.mongo.url);

// 
// Define a helper on when.js to shim the missing support of promises on Model::save
// 
when.saved = function(docs) {
	if (Array.isArray(docs)) {
		return when.all(docs.map(when.saved));
	}

	var deferred = when.defer();

	docs.save(function(err, doc) {
		if (err) {
			return deferred.reject(err);
		}

		deferred.resolve(doc);
	});

	return deferred.promise;
};
