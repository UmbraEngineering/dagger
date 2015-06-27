
// 
// Checks an array of primatives for duplicate values
// 
// @param {arr} the array to test
// @return boolean
// 
module.exports = function(arr) {
	arr = arr.slice();
	arr.sort();

	return arr.some(function(current, index) {
		if (index === 0) {
			return false;
		}

		return (current === arr[index - 1]);
	});
};
