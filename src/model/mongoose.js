
var conf      = require('../config');
var mongoose  = module.exports = require('mongoose');

// Open a new connection
mongoose.connect(conf.mongodb.url);
