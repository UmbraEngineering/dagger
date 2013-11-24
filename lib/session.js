
var oath   = require('oath');
var merge  = require('merge-recursive');
var app    = require('./index').app;

var Role; app.models.require('roles').resolve(function(Model) {
	Role = Model;
});

var AuthToken; app.models.require('auth-tokens').resolve(function(Model) {
	AuthToken = Model;
});

var AuthEntity; app.models.require('auth-entities').resolve(function(Model) {
	AuthEntity = Model;
});

var User; app.models.require(app.conf.auth.userModel).resolve(function(Model) {
	User = Model;
});

// 
// Define the session class
// 
var Session = module.exports.Session = function() {
	this.token   = null;
	this.user    = null;
	this.entity  = null;
	this.perms   = null;
};

// -------------------------------------------------------------

// 
// Given an instance of AuthToken, initializes the session
// 
Session.prototype.initializeFromToken = function(token, promise) {
	var self = this;
	promise = promise || new oath();

	self.token = token;

	User.findById(self.token.user, function(err, user) {
		if (err) {
			return promise.reject(err);
		}

		if (! user) {
			return promise.reject(
				new app.Resource.HttpError(403, 'Authentication failure: the user linked to this authentication token does not exist')
			);
		}

		self.user = user;

		AuthEntity.findById(self.user.auth).populate('roles').exec(function(err, entity) {
			if (err) {
				return promise.reject(err);
			}

			if (! entity) {
				return promise.reject(
					new app.Resource.HttpError(500, 'User does not have an associated authentication entity; This may mean that your user data is corrupted')
				);
			}

			self.entity = entity;

			self._buildPermissions();
			self.token.updateTTL().then(promise.resolve.bind(promise), function(err) {
				promise.reject(
					new app.Resource.HttpError(500, err)
				);
			});
		});
	});

	return promise.promise;
};

// -------------------------------------------------------------

// 
// Build a complete permissions tree for the auth entity
// 
Session.prototype._buildPermissions = function() {
	var perms = this.perms = { };

	this.entity.roles.forEach(function(role) {
		merge.recursive(perms, role.toPerms());
	});

	merge.recursive(this.perms, this.entity.perms || { });
};

// -------------------------------------------------------------

// 
// Checks if the user has any subpermissions under the main category
// 
Session.prototype.hasAnySubPermission = function(perm) {
	perm = this.perms[perm];
	return (perm && (perm.create || perm.read || perm.update || perm.delete));
};

// 
// Checks if the auth entity has the given permission
// 
Session.prototype.hasPermission = function(perm) {
	var promise = new oath();

	// Get all arguments given after the permission to test. These will be passed to
	// any test methods on the user model in the case of conditional permissions
	var args = Array.prototype.slice.call(arguments);

	// Push the promise into args so that the custom method gets it
	args[0] = promise;

	// Run the actual lookup asynchronously
	process.nextTick(this._hasPermission.bind(this, promise, perm, args));

	return promise.promise;
};

// 
// Do the actual permission test for Session::hasPermission
// 
Session.prototype._hasPermission = function(promise, perm, args) {
	if (! this.perms) {
		return promise.reject(
			new Error('Session::hasPermissions - Must run _buildPermissions before lookups')
		);
	}

	// Make sure we are looking for a valid permission (eg. "users.update")
	perm = perm.split('.');
	if (perm.length !== 2) {
		return promise.reject(
			new Error('Session::hasPermissions - Invalid permission given for lookup')
		);
	}

	var model = perm[0];
	var action = perm[1];

	// Find the correct permission tree
	var tree = this.perms[model];
	if (! tree) {
		return this._testGlobPermission(promise, action, args);
	}

	// Global conditional permission (eg. {users: 'ifSelf'})
	if (typeof tree === 'string') {
		return this.user[tree].apply(this.user, args);
	}

	// Detailed activity permission (eg: {users: {create: false, read: true}})
	if (typeof tree === 'object' && tree) {
		var value = tree[action];

		// If the value is false or not defined, dont grant permission
		if (! value) {
			return this._testGlobPermission(promise, action, args);
		}

		// Detailed conditional permission (eg. {users: {update: 'ifOwn'}})
		if (typeof value === 'string') {
			return this.user[value].apply(this.user, args);
		}
		
		// Handle true values (eg. {users: {update: true}})
		if (value) {
			return promise.resolve(value);
		}

		return this._testGlobPermission(promise, action, args);
	}

	return this._testGlobPermission(promise, action, args);
};

// -------------------------------------------------------------

// 
// Checks if the user has a glob permission "*.action" that would give them
// permission they otherwise dont have. Mostly this applies to administrator-type
// users.
// 
Session.prototype._testGlobPermission = function(promise, action, args) {
	var perm = this.perms['*'];
	if (! action || ! perm) {
		return promise.resolve(false);
	}

	if (typeof perm === 'string') {
		return this.user[perm].apply(this.user, args);
	}

	if (typeof perm === 'object') {
		perm = perm[action];

		if (! perm) {
			promise.resolve(false);
		}

		if (typeof perm === 'string') {
			return this.user[value].apply(this.user, args);
		}

		promise.resolve(!! perm);
	}
};

// -------------------------------------------------------------

// 
// Add permissions to the auth entity
// 
Session.prototype.addPermissions = function(perms, promise) {
	var self = this;
	promise = promise || new oath();

	if (! Array.isArray(perms)) {
		perms = [perms];
	}

	perms.forEach(function(perm) {
		perm = perm.split(' if ');
		var cond = perm[1] || true;
		perm = perm[0].split('.');

		if (perm.length !== 2) {
			throw new Error('Session::addPermissions - Permission strings must follow the format "model.action"');
		}
		
		var model = perm[0];
		var action = perm[1];

		if (! self.entity.perms[model]) {
			self.entity.perms[model] = { };
		}

		if (action === '*') {
			verbs.forEach(function(verb) {
				self.entity.perms[model][verb] = cond;
			});
		} else {
			self.entity.perms[model][action] = cond;
		}
	});

	self.entity.save(function(err) {
		if (err) {
			return promise.reject(err);
		}

		self._buildPermissions();
		promise.resolve();
	});

	return promise.promise || promise;
};

// -------------------------------------------------------------

// 
// Remove the given permissions from the auth entity
// 
Session.prototype.removePermissions = function(perms, promise) {
	promise = promise || new oath();

	var self = this;

	if (! Array.isArray(perms)) {
		perms = [perms];
	}

	perms.forEach(function(perm) {
		perm = perm.split('.');

		if (perm.length !== 2) {
			throw new Error('Session::removePermissions - Permission strings must follow the format "model.action"');
		}
		
		var model = perm[0];
		var action = perm[1];

		if (! self.entity.perms[model]) {
			return process.nextTick(function() {
				promise.resolve();
			});
		}

		if (action === '*') {
			delete self.entity.perms[model];
		} else {
			delete self.entity.perms[model][action];
		}
	});

	self.save(function(err) {
		if (err) {
			return promise.reject(err);
		}

		self._buildPermissions();
		promise.resolve();
	});

	return promise.promise || promise;
};
