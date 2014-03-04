
// 
// Loads configuration files
// 

var PATH  = require('./paths');
var conf  = require('node-conf');

conf.setConfDir(PATH.CONFIG);

module.exports = conf.load(process.env.NODE_ENV || 'production');
