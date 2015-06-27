
module.exports = function(arr, predicate) {
	var found = null;

	arr.some(function(value, index, arr) {
		if (predicate(value, index, arr)) {
			found = value;
			return true;
		}
	});

	return found;
};
