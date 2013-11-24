
exports.initialize = function(conf) {

	// 
	// AppObject Class
	// 
	var AppObject = exports.AppObject = function(root) {
		// 
	};

	// 
	// Returns a stack trace
	// 
	AppObject.prototype.stacktrace = function(arr) {
		try {
			throw new Error();
		} catch (e) {
			var stack = e.stack;
			if (arr) {
				stack = stack.split('\n');
			}

			return stack;
		}
	}
	
	// Return exports from the initialize method to simplify things
	return exports;

};