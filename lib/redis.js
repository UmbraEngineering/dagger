
var app = require('dagger.js').app;

module.exports = require('redis-url').connect(app.conf.redis.url);
