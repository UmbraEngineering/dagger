
var Class    = require('../../class');
var Promise  = require('promise-es6').Promise;

// 
// The base authorization scheme
// 
// All other authorization schemes should be based on this one,
// with all of the following methods, all of which return a
// promise.
// 
var Authorization = module.exports = Class.extend({
	
	// 
	// Authorizes the user to read the given objects. Should return an
	// array of all of the given objects that user *does* have permission
	// to *read*.
	// 
	// @param {objs} the objects being tested
	// @param {req} the request object for the current request
	// @return promise
	// 
	readList: function(objs, req) {
		throw new Error('Authoriaztion::readList must be overriden');
	},
	
	// 
	// Authorizes the user to read the given object. Should return a boolean:
	// `true` if the user *does* have permision to *read* the given object,
	// `false` otherwise.
	// 
	// @param {obj} the object being tested
	// @param {req} the request object for the current request
	// @return promise
	// 
	readDetail: function(obj, req) {
		throw new Error('Authoriaztion::readDetail must be overriden');
	},
	
	// 
	// Authorizes the user to create the given objects. Should return an
	// array of all of the given objects that user *does* have permission
	// to *create*.
	// 
	// @param {objs} the objects being tested
	// @param {req} the request object for the current request
	// @return promise
	// 
	createList: function(objs, req) {
		throw new Error('Authoriaztion::createList must be overriden');
	},
	
	// 
	// Authorizes the user to create the given object. Should return a boolean:
	// `true` if the user *does* have permision to *create* the given object,
	// `false` otherwise.
	// 
	// @param {obj} the object being tested
	// @param {req} the request object for the current request
	// @return promise
	// 
	createDetail: function(obj, req) {
		throw new Error('Authoriaztion::createDetail must be overriden');
	},
	
	// 
	// Authorizes the user to update the given objects. Should return an
	// array of all of the given objects that user *does* have permission
	// to *update*.
	// 
	// @param {objs} the objects being tested
	// @param {req} the request object for the current request
	// @return promise
	// 
	updateList: function(objs, req) {
		throw new Error('Authoriaztion::updateList must be overriden');
	},
	
	// 
	// Authorizes the user to update the given object. Should return a boolean:
	// `true` if the user *does* have permision to *update* the given object,
	// `false` otherwise.
	// 
	// @param {obj} the object being tested
	// @param {req} the request object for the current request
	// @return promise
	// 
	updateDetail: function(obj, req) {
		throw new Error('Authoriaztion::updateDetail must be overriden');
	},
	
	// 
	// Authorizes the user to delete the given objects. Should return an
	// array of all of the given objects that user *does* have permission
	// to *delete*.
	// 
	// @param {objs} the objects being tested
	// @param {req} the request object for the current request
	// @return promise
	// 
	deleteList: function(objs, req) {
		throw new Error('Authoriaztion::deleteList must be overriden');
	},
	
	// 
	// Authorizes the user to delete the given object. Should return a boolean:
	// `true` if the user *does* have permision to *delete* the given object,
	// `false` otherwise.
	// 
	// @param {obj} the object being tested
	// @param {req} the request object for the current request
	// @return promise
	// 
	deleteDetail: function(obj, req) {
		throw new Error('Authoriaztion::deleteDetail must be overriden');
	}

});
