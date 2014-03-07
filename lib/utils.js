
Error.getStackTrace = function(opts) {
	opts = opts || { };

	var stack = opts.stack;

	if (! stack) {
		try {
			throw new Error();
		} catch (err) {
			stack = err.stack;
		}
	}

	if (opts.split) {
		stack = stack.split('\n').slice(1).map(function(str) {
			return str.trim();
		});
	}

	return stack;
};
