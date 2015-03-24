
var Class          = require('../../class');
var Promise        = require('promise-es6').Promise;
var Authorization  = require('./index');

// 
// A simple authorization scheme that allows anyone to do anything
// 
var AllowAllAuthorization = module.exports = Class.extend(Authorization, {
	
	readList: function(objs, req) {
		return Promise.resolve(objs);
	},

	readDetail: function(obj, req) {
		return Promise.resolve(true);
	},

	createList: function(objs, req) {
		return Promise.resolve(objs);
	},

	createDetail: function(obj, req) {
		return Promise.resolve(true);
	},

	updateList: function(objs, req) {
		return Promise.resolve(objs);
	},

	updateDetail: function(obj, req) {
		return Promise.resolve(true);
	},

	deleteList: function(objs, req) {
		return Promise.resolve(objs);
	},

	deleteDetail: function(obj, req) {
		return Promise.resolve(true);
	}

});
