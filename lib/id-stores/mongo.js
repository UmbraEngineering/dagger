
var oath      = require('oath');
var mongoose  = require('mongoose');
var IdStore   = require('./index').IdStore;
var app       = require('../index').app;

var IdStoreSchema = new mongoose.Schema({
	model: {type: String, unique: true},
	nextId: {type: Number, default: 1}
});

var IdStoreModel = mongoose.model('IdStore', IdStoreSchema);

var MongoIdStore = exports.IdStore = function() {
	this.client = mongoose.createConnection(app.conf.mongodb.url);
};

MongoIdStore.prototype = new IdStore();

MongoIdStore.prototype.next = function(model) {
	var promise = new oath();

	IdStoreModel.findOneAndUpdate({model: model}, {$inc: {nextId: 1}}, {new: false}, function(err, data) {
		if (err) {
			promise.reject(err);
		}

		promise.resolve(data.nextId);
	});
	
	return promise;
};
