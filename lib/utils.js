
// 
// Just some useful utilities..
// 

exports.uniq = function(arr, createNew) {
	if (createNew) {
		arr = arr.slice();
	}

	for (var i = 0; i < arr.length; i++) {
		for (var j = 0; j < arr.length; j++) {
			if (i === j) {continue;}
			if (arr[i] === arr[j]) {
				arr.splice(j--, 1);
			}
		}
	}

	return arr;
};

exports.union = function(first) {
	var others = Array.prototype.slice.call(arguments, 1);
	var result = first.concat.apply(first, others);
	return exports.uniq(result);
};
