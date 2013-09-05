
exports.remover = function(fields) {
	return function(object) {
		fields.forEach(function(field) {
			field = field.split('.');

			var scope = object;
			var len = field.length;

			try {
				for (var i = 0, c = len - 1; i < c; i++) {
					scope = scope[field[i]];
				}	
			} catch(e) {return;}

			delete scope[field.pop()];
		});
	};
};
