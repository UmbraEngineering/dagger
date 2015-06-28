
describe('Class', function() {
	var Class = require('../../src/class');

	it('should export a constructor function', function() {
		expect(typeof Class).toBe('function');
		expect((new Class()) instanceof Class).toBe(true);
	});

	it('should have a create function which creates instances', function() {
		expect(Class.create() instanceof Class).toBe(true);
	});

	it('should have a parent of Object', function() {
		expect(Class._parent).toBe(Object);
	});
});
