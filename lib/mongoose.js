
var conf      = require('./conf');
var mongoose  = require('mongoose');

// Patch mongoose-types bug (#17 and #21)
// @link {https://github.com/bnoguchi/mongoose-types/}
var bson = require(__dirname + '/../node_modules/mongoose/node_modules/mongodb/node_modules/bson');
mongoose.mongo.BinaryParser = bson.BinaryParser;

exports.mongoose    = mongoose;
exports.connection  = mongoose.createConnection(conf.mongodb.url);
