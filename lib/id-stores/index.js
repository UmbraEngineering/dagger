
var app = require('dagger.js').app;

// 
// Attempt to load the module from the id-stores directory. If the module is not
// found, attempt to load it relative to the project root (allows custom id-stores)
// 
exports.require = function(type) {
	try {
		require.resolve('./' + type);
		type = './' + type;
	} catch (e) {
		type = app.path(type);
	}
	return require(type);
};

// 
// Define the IdStore type
// 
var IdStore = exports.IdStore = function() {
	// 
};
