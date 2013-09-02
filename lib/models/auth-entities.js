
var oath   = require('oath');
var app    = require('../index').app;
var merge  = require('merge-recursive');

var Role = app.models.require('roles');

var verbs = ['create', 'read', 'update', 'delete'];

var AuthEntity = app.models.create('authentities', {

	// Do not directly expose authentities. These should only ever be accessed as children of users.
	expose: false,

	schema: {
		roles: [{type: app.models.types.ObjectId, ref: 'roles'}],
		perms: { }
	},

	hooks: {
		// ...
	},

	methods: {

	// -------------------------------------------------------------
		
		// 
		// Build a complete permissions tree for the auth entity
		// 
		_buildPermissions: function(promise) {
			promise = promise || new oath();

			var self = this;

			process.nextTick(function() {
				if (self.populated('roles')) {
					return doBuild();
				}

				self.populate('roles', function(err) {
					if (err) {
						return promise.reject(err);
					}

					doBuild();
				});

				function doBuild() {
					var perms = self._permissions = { };
					
					self.roles.forEach(function(role) {
						merge.recursive(perms, role.toPerms());
					});

					merge.recursive(perms, self.perms);

					promise.resolve(perms);
				}
			});

			return promise.promise || promise;
		},

	// -------------------------------------------------------------

		// 
		// Checks if the auth entity has the given permission
		// 
		hasPermission: function(perm) {
			if (! this._permissions) {
				throw new Error('AuthEntity::hasPermissions - Must run _buildPermissions before lookups');
			}

			// Get all arguments given after the permission to test. These will be passed to
			// any test methods on the user model in the case of conditional permissions
			var args = Array.prototype.slice.call(arguments, 1);

			// Make sure we are looking for a valid permission (eg. "users.update")
			perm = perm.split('.');
			if (perm.length !== 2) {
				throw new Error('AuthEntity::hasPermissions - Invalid permission given for lookup');
			}

			// Find the correct permission tree
			var tree = this._permissions[perm[0]];
			if (! tree) {
				return false;
			}

			// Global conditional permission (eg. {users: 'ifOwn'})
			if (typeof tree === 'string') {
				if (! this.parent) {
					throw new Error('AuthEntity::hasPermissions - Found a conditional permission, but cannot test without a parent user doc');
				}

				return this.parent[tree].apply(this.parent, args);
			}

			// Detailed activity permission (eg: {users: {create: false, read: true}})
			if (typeof tree === 'object' && tree) {
				var value = tree[perm[1]];

				// If the value is false or not defined, dont grant permission
				if (! value) {
					return false;
				}

				// Detailed conditional permission (eg. {users: {update: 'ifOwn'}})
				if (typeof value === 'string') {
					if (! this.parent) {
						throw new Error('AuthEntity::hasPermissions - Found a conditional permission, but cannot test without a parent user doc');
					}

					value = this.parent[value].apply(this.parent, args);
				}

				return !! value;
			}

			throw new Error('AuthEntity::hasPermissions - Did not understand permissions stored in database; Permissions could be corrupted');
		},

	// -------------------------------------------------------------

		// 
		// Add permissions to the auth entity
		// 
		addPermissions: function(perms, promise) {
			promise = promise || new oath();

			var self = this;

			if (! Array.isArray(perms)) {
				perms = [perms];
			}

			perms.forEach(function(perm) {
				perm = perm.split(' if ');
				var cond = perm[1] || true;
				perm = perm[0].split('.');

				if (perms.length !== 2) {
					throw new Error('AuthEntity::addPermissions - Permission strings must follow the format "model.action"');
				}

				if (! self.perms[perm[0]]) {
					self.perms[perm[0]] = { };
				}

				if (perm[1] === '*') {
					verbs.forEach(function(verb) {
						self.perms[perm[0]][verb] = cond;
					});
				} else {
					self.perms[perm[0]][perm[1]] = cond;
				}
			});

			self.save(function(err) {
				if (err) {
					return promise.reject(err);
				}

				self._buildPermissions(promise);
			});

			return promise.promise || promise;
		},

	// -------------------------------------------------------------

		// 
		// Remove the given permissions from the auth entity
		// 
		removePermissions: function(perms, promise) {
			promise = promise || new oath();

			var self = this;

			if (! Array.isArray(perms)) {
				perms = [perms];
			}

			perms.forEach(function(perm) {
				perm = perm.split('.');

				if (perms.length !== 2) {
					throw new Error('AuthEntity::addPermissions - Permission strings must follow the format "model.action"');
				}

				if (! self.perms[perm[0]]) {
					return process.nextTick(function() {
						promise.resolve();
					});
				}

				if (perm[1] === '*') {
					delete self.perms[perm[0]];
				} else {
					delete self.perms[perm[0]][perm[1]];
				}
			});

			self.save(function(err) {
				if (err) {
					return promise.reject(err);
				}

				self._buildPermissions(promise);
			});

			return promise.promise || promise;
		}

	}

});
