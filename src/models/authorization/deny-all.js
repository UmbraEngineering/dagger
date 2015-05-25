
var Class          = require('../../class');
var Promise        = require('promise-es6').Promise;
var Authorization  = require('./index');

// 
// A simple authorization scheme that does not allow anyone to do anything
// 
var DenyAllAuthorization = module.exports = Class.extend(Authorization, {
	
	readList: function(objs, req) {
		return Promise.resolve([ ]);
	},

	readDetail: function(obj, req) {
		return Promise.resolve(false);
	},

	createList: function(objs, req) {
		return Promise.resolve([ ]);
	},

	createDetail: function(obj, req) {
		return Promise.resolve(false);
	},

	updateList: function(objs, req) {
		return Promise.resolve([ ]);
	},

	updateDetail: function(obj, req) {
		return Promise.resolve(false);
	},

	deleteList: function(objs, req) {
		return Promise.resolve([ ]);
	},

	deleteDetail: function(obj, req) {
		return Promise.resolve(false);
	}

});
