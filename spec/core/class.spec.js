
var Class = require('../../src/class');

describe('#<Class>', function() {
	it('should export a constructor function', function() {
		expect(typeof Class).toBe('function');
		expect((new Class()) instanceof Class).toBe(true);
	});

	it('should have a parent of Object', function() {
		expect(Class._parent).toBe(Object);
	});

	describe('::create', function() {
		it('should create a new instance', function() {
			expect(Class.create() instanceof Class).toBe(true);
		});
	});

	describe('::extend', function() {
		it('should return a new constructor function that inherits from Class', function() {
			var SubClass = Class.extend({ });
			expect(typeof SubClass).toBe('function');
			expect(SubClass._parent).toBe(Class);

			var subInstance = new SubClass();
			expect(subInstance instanceof SubClass).toBe(true);
			expect(subInstance instanceof Class).toBe(true);
		});

		describe('#<the new sub class>', function() {
			describe('::create', function() {
				it('should create a new instance', function() {
					var SubClass = Class.extend({ });

					expect(typeof SubClass.create).toBe('function');
					expect(SubClass.create() instanceof SubClass).toBe(true);
					expect(SubClass.create() instanceof Class).toBe(true);
				});
			});

			describe('::extend', function() {
				it('should return a new constructor function that inherits from SubClass', function() {
					var SubClass = Class.extend({ });
					var SubSubClass = SubClass.extend({ });

					expect(typeof SubSubClass).toBe('function');
					expect(SubSubClass._parent).toBe(SubClass);
					expect(SubSubClass._parent._parent).toBe(Class);

					var subSubInstance = new SubSubClass();
					expect(subSubInstance instanceof SubSubClass).toBe(true);
					expect(subSubInstance instanceof SubClass).toBe(true);
					expect(subSubInstance instanceof Class).toBe(true);
				});
			});

			describe('::inherits', function() {
				it('should return true for any ancestor class', function() {
					var SubClass = Class.extend({ });
					var SubSubClass = SubClass.extend({ });

					expect(SubClass.inherits(Class)).toBe(true);
					expect(SubClass.inherits(Object)).toBe(true);
					expect(SubSubClass.inherits(SubClass)).toBe(true);
					expect(SubSubClass.inherits(Class)).toBe(true);
					expect(SubSubClass.inherits(Object)).toBe(true);
				});

				it('should return false for any non-ancestor class', function() {
					var SubClass = Class.extend({ });
					var SubSubClass = SubClass.extend({ });

					expect(SubClass.inherits(Date)).toBe(false);
					expect(SubClass.inherits(Array)).toBe(false);
					expect(SubSubClass.inherits(Date)).toBe(false);
					expect(SubSubClass.inherits(Array)).toBe(false);
					expect(SubClass.inherits(SubSubClass)).toBe(false);
				});
			});

			describe('::init', function() {
				it('should be used as the class\' constructor if given', function() {
					var init = jasmine.createSpy('init');
					var SubClass = Class.extend({ init: init });

					var instance = new SubClass('-test value-');
					expect(instance.init).toBe(init);
					expect(instance.init).toHaveBeenCalledWith('-test value-');
				});
			});

			describe('inheritence', function() {
				var BaseClass;

				beforeEach(function() {
					BaseClass = Class.extend({
						prop1: 'foo',
						func1: function() {
							return 'baseclass';
						},
						getProp1: function() {
							return this.prop1;
						}
					});
				});

				it('should inherit properties from class to subclass', function() {
					var SubClass = BaseClass.extend({
						prop1: 'bar',
						prop2: 'baz'
					});

					var subInstance = new SubClass();

					expect(subInstance.getProp1).toBe(BaseClass.prototype.getProp1);
					expect(subInstance.getProp1()).toBe('bar');
					expect(subInstance.func1()).toBe('baseclass');
				});

				it('should overwrite new values given in subclasses', function() {
					var SubClass = BaseClass.extend({
						func1: function() {
							return 'subclass';
						}
					});

					var baseInstance = new BaseClass();
					var subInstance = new SubClass();

					expect(subInstance.func1).not.toBe(baseInstance.func1);
					expect(baseInstance.func1()).toBe('baseclass');
					expect(subInstance.func1()).toBe('subclass');
				});
			});

			describe('super', function() {
				var BaseClass;

				beforeEach(function() {
					BaseClass = Class.extend({
						func: function() {
							return 'baseclass::func';
						}
					});

					spyOn(BaseClass.prototype, 'func').and.callThrough();
				});

				it('should call the super method from the parent class', function() {
					var SubClass = BaseClass.extend({
						func: function() {
							return this._super();
						}
					});

					var subInstance = new SubClass();

					expect(subInstance.func).not.toBe(BaseClass.prototype.func);
					expect(subInstance.func()).toBe('baseclass::func');
					expect(BaseClass.prototype.func).toHaveBeenCalled();
				});

				it('should pass through multiple levels of inheritence until a _super is found', function() {
					var SubClass = BaseClass.extend({ });
					var SubSubClass = SubClass.extend({
						func: function() {
							return this._super();
						}
					});

					var subSubInstance = new SubSubClass();

					expect(subSubInstance.func).not.toBe(BaseClass.prototype.func);
					expect(subSubInstance.func).not.toBe(SubClass.prototype.func);
					expect(subSubInstance.func()).toBe('baseclass::func');
					expect(BaseClass.prototype.func).toHaveBeenCalled();
				});

				it('should not persist the _super method outside of methods', function() {
					var SubClass = BaseClass.extend({
						func: function() {
							return this._super();
						}
					});

					var subInstance = new SubClass();

					expect(subInstance._super).not.toBeDefined();
					subInstance.func();
					expect(subInstance._super).not.toBeDefined();
				});

				it('should be chainable', function() {
					var SubClass = BaseClass.extend({
						func: function() {
							return this._super();
						}
					});
					var SubSubClass = SubClass.extend({
						func: function() {
							return this._super();
						}
					});

					var subSubInstance = new SubSubClass();

					expect(subSubInstance.func).not.toBe(BaseClass.prototype.func);
					expect(subSubInstance.func).not.toBe(SubClass.prototype.func);
					expect(subSubInstance.func()).toBe('baseclass::func');
					expect(BaseClass.prototype.func).toHaveBeenCalled();
				});
			});

			describe('.onExtend', function() {
				it('should be called for every newly created subclass if defined', function() {
					var BaseClass = Class.extend({ });
					BaseClass.onExtend = jasmine.createSpy('onExtend');

					var SubClassA = BaseClass.extend({ });
					expect(BaseClass.onExtend).toHaveBeenCalled();
					expect(mostRecent().object).toBe(SubClassA);

					var SubClassB = BaseClass.extend({ });
					expect(BaseClass.onExtend).toHaveBeenCalled();
					expect(mostRecent().object).toBe(SubClassB);

					var SubClassC = BaseClass.extend({ });
					expect(BaseClass.onExtend).toHaveBeenCalled();
					expect(mostRecent().object).toBe(SubClassC);

					function mostRecent() {
						return BaseClass.onExtend.calls.mostRecent();
					}
				});
			});
		});

		describe('mixin support', function() {
			var MixinA, MixinB, MixinC;

			beforeEach(function() {
				MixinA = { propA: 'valueA' };
				MixinB = { propB: 'valueB' };
				MixinC = { propA: 'valueC' };
			});

			it('should be able to extend a class with multiple mixin objects', function() {
				var SubClass = Class.extend(MixinA, MixinB);

				expect(SubClass.inherits(Class)).toBe(true);
				expect(SubClass.inherits(MixinA)).toBe(false);
				expect(SubClass.inherits(MixinB)).toBe(false);

				var subInstance = new SubClass();
				expect(subInstance.propA).toBe('valueA');
				expect(subInstance.propB).toBe('valueB');
			});

			it('should prefer properties from later mixins', function() {
				var SubClass = Class.extend(MixinA, MixinC);

				// MixinC should overwrite propA from MixinA
				var subInstance = new SubClass();
				expect(subInstance.propA).toBe('valueC');
			});

			it('should be able to mixin from other classes', function() {
				var MixinClass = Class.extend({
					propC: 'valueC'
				});

				var SubClass = Class.extend(MixinClass);

				var subInstance = new SubClass();
				expect(subInstance.propC).toBe('valueC');
				expect(subInstance instanceof SubClass).toBe(true);
				expect(subInstance instanceof Class).toBe(true);
				expect(subInstance instanceof MixinClass).toBe(false);
			});
		});
	});

	describe('.onExtend', function() {
		it('should be called for every newly created subclass if defined', function() {
			Class.onExtend = jasmine.createSpy('onExtend');

			var SubClassA = Class.extend({ });
			expect(Class.onExtend).toHaveBeenCalled();
			expect(mostRecent().object).toBe(SubClassA);

			var SubClassB = Class.extend({ });
			expect(Class.onExtend).toHaveBeenCalled();
			expect(mostRecent().object).toBe(SubClassB);

			var SubClassC = Class.extend({ });
			expect(Class.onExtend).toHaveBeenCalled();
			expect(mostRecent().object).toBe(SubClassC);

			function mostRecent() {
				return Class.onExtend.calls.mostRecent();
			}
		});
	});
});
