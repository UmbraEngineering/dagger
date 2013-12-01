
var wrench  = require('wrench');
var PATH    = require('./paths');

// 
// Allows loading of dagger's internal modules
// 
exports.require = function(file) {
	return require('./' + file);
};

// 
// Start a dagger server
// 
exports.start = function() {
	// 
};

// 
// Load all of the resources in a directory recursively
// 
exports.loadResources = function(dir) {
	return exports.requireRecursive(dir || PATH.RESOURCES);
};

// 
// Load all of the models in a directory recursively
// 
exports.loadModels = function(dir) {
	return exports.requireRecursive(dir || PATH.MODELS);
};

// 
// Load all of the files in a directory structure recursively
// 
exports.requireRecursive = function(dir) {
	// 
	// TODO
	// 
};
