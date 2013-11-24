
var PATH = require('./paths');
var config = require('node-conf');

config.setConfDir(PATH.CONFIG);

module.exports = config.load(process.env.NODE_ENV);
