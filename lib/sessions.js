
var oath    = require('oath');
var crypto  = require('crypto');
var uuid    = require('uuid-v4');
var app     = require('dagger.js').app;

var User = app.models.require(app.conf.auth.userModel)();

var Session = app.models.create('sessions', {

	// expose: false,
	
	schema: {
		token: String,
		user: {type: app.models.types.ObjectId, ref: app.conf.auth.userModel},
		sessionData: { },
		lastAccessed: Date,
		expires: Date
	},

	hooks: {

		// 
		// Generate an access token for the session when we create it
		// 
		'pre::create': function(pre) {
			Session.generateAccessToken().then(
				function(token) {
					this.token = token;
					next();
				}.bind(this),
				next);
		}
	},

	generateAccessToken: function(promise) {
		promise = promise || new oath();

		crypto.randomBytes(64, function(err, salt) {
			if (err) {
				return oath.reject(err);
			}

			// Do the hashing..
			crypto.pbkdf2(uuid(), salt, 100, 64, function(err, key) {
				if (err) {
					return oath.reject(err);
				}

				promise.resolve(new Buffer(key).toString('base64'));
			});
		});

		return promise;
	}

});
