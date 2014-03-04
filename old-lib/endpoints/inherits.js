
// 
// Inherits some useful methods from the mongoose model to the dagger
// model to make things like finds cleaner
// 

var methods = ['find', 'findOne', 'findById'];

exports.extend = function(Class) {
	methods.forEach(function(method) {
		Class.prototype[method] = function() {
			return this.mong[method].apply(this.mong, arguments);
		};
	});
};
