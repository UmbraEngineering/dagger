
var Class          = require('../../class');
var Promise        = require('promise-es6').Promise;
var Authorization  = require('./index');

// 
// A simple authorization scheme that allows anyone to do anything
// 
var AllowAllAuthorization = module.exports = Class.extend(Authorization, {
	
	readList: function(objs) {
		return Promise.resolve(objs);
	},

	readDetail: function() {
		return Promise.resolve(true);
	},

	createList: function(objs) {
		return Promise.resolve(objs);
	},

	createDetail: function() {
		return Promise.resolve(true);
	},

	updateList: function(objs) {
		return Promise.resolve(objs);
	},

	updateDetail: function() {
		return Promise.resolve(true);
	},

	deleteList: function(objs) {
		return Promise.resolve(objs);
	},

	deleteDetail: function() {
		return Promise.resolve(true);
	}

});
