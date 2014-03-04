
var fs      = require('fs');
var jws     = require('jsjws');
var dagger  = require('dagger.js');

var conf       = dagger.require('conf');
var paths      = dagger.require('paths');
var HttpError  = dagger.require('http-meta');

var key = fs.readFileSync(paths.resolve('CONFIG', conf.auth.keyFile));

exports = module.exports = function(req, next) {
	if (req.pathname === '/authtokens') {
		// Attempt to create a new auth token
		if (req.method === 'POST') {
			// 

			return next(true);
		}

		// Attempt to update an auth token by first authenticating the given token, and
		// then creating a new token for the authenticated user
		if (req.method === 'PUT' || req.method === 'PATCH') {
			// 

			return next(true);
		}

		// Respond with a 405 for any other method on the token route
		return next(new HttpError(405, 'Cannot ' + req.method + ' on /authtokens'));
	}

	// Attempt to authenticate any existing auth token
	var token = req.headers
};

exports.generateKeyFiles = function() {
	require('fs').writeFileSync('./private_key.pem', jws.generatePrivateKey(2048,65537).toPrivatePem('utf8'))
};
