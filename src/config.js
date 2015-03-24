
// 
// Loads configuration files
// 

var paths  = require('./paths');
var conf   = require('node-conf');

conf.setConfDir(paths.config);

module.exports = conf.load(process.env.NODE_ENV || 'production');
