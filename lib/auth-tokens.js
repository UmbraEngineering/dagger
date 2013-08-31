
var oath    = require('oath');
var crypto  = require('crypto');
var uuid    = require('uuid-v4');
var app     = require('dagger.js').app;

// We use this a lot...
var conf = app.conf.auth;

// If auth isn't enabled, we can skip all of this
if (! conf.enabled) {return;}

var User = app.models.require(conf.userModel)();

var AuthToken = app.models.create(conf.authTokenEndpoint, {

	// 
	// Don't auto-generate an endpoint for this model, it needs to be custom made
	// to handle authentication, and also to avoid bad (insecure) operations
	// 
	expose: false,
	
	schema: {
		token: {type: String, index: {unique: true}},
		user: {type: app.models.types.ObjectId, ref: conf.userModel},
		expires: {type: Date, expires: conf.authTokenTTL}
	},

	hooks: {

		// 
		// Generate an access token for the session when we create it
		// 
		'pre::create': function(next) {
			AuthToken.generateToken().then(
				function(token) {
					this.token = token;
					next();
				}.bind(this),
				next);
		}
	},

	methods: {
		updateTTL: function(promise) {
			promise = promise || new oath();

			token.expires = Date.now();
			token.save(function(err, token) {
				if (err) {
					return promise.reject(err);
				}

				promise.resolve(token);
			});

			return promise.promise || promise;
		}
	}

	generateToken: function(promise) {
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

		return promise.promise || promise;
	},

	// 
	// Update the given token's TTL
	// 
	updateTokenTTL: function(token, promise) {
		promise = promise || new oath();

		AuthToken.findOne({ token: token }, function(err, token) {
			if (err) {
				return promise.reject(err);
			}

			token.updateTTL(promise);
		});

		return promise.promise || promise;
	}

});

// -------------------------------------------------------------

app.Resource.create(conf.authTokenEndpoint, {

	parent: null,
	route: '/' + conf.authTokenEndpoint + '/:tokenId?',

	// This resource has to be public or no one will ever be able to authenticate
	public: true,

// -------------------------------------------------------------
//  Login

	post: function(req) {
		var url = req.url;
		this._post(req).then(
			function(data) {
				req.setHeader('Location', url + '/' + data._id);
				req.send(201, data);
			},
			function(err) {
				err.send(req);
			});
	},

	_post: function(req) {
		var promise = new oath();

		// Short-circuit if given an id (because that's kind of stupid...)
		if (req.params.tokenId) {
			process.nextTick(function() {
				req.sendError(405);
			});

			return promise;
		}

		// Grab the credentials from the request body
		var userid = req.body[conf.userField];
		var password = req.body[conf.passwordField];

		// Fetch the user data
		User.findOne().where(conf.userField, userid).exec(function(err, user) {
			if (err) {
				return promise.reject(
					new app.Resource.HttpError(500, err)
				);
			}

			// Handle non-existent username errors
			if (! user) {
				return promise.reject(
					new app.Resource.HttpError(401, 'Authentication failed: user does not exist')
				);
			}

			// Validate the given credentials
			conf.testPassword(user, password, new oath()).then(
				function(passed) {
					if (! passed) {
						return promise.reject(
							new app.Resource.HttpError(401, 'Authentication failed: password incorrect')
						);
					}

					// Create the new auth token
					var token = new AuthToken({ user: user._id });
					token.save(function(err, token) {
						if (err) {
							return promise.reject(
								new app.Resource.HttpError(500, err)
							);
						}

						promise.resolve(token.sanitize());
					});
				},
				function(err) {
					promise.reject(
						new app.Resource.HttpError(500, err)
					);
				});
		});

		return promise.promise;
	},

// -------------------------------------------------------------
//  Logout

	del: function(req) {
		// 
	}

});
