
var oath   = require('oath');
var app    = require('../index').app;
var merge  = require('merge-recursive');

var Role = app.models.require('roles');

var AuthEntity = app.models.create('auth-entities', {

	schema: {
		perms: { },
		roles: [{type: app.models.types.ObjectId, ref: 'roles'}]
	},

	methods: {
		addRole: function(role, callback) {
			var entity = this;

			Role().findOne({ name: role }, function(err, role) {
				if (err) {
					return callback(err);
				}

				if (! role) {
					return callback('No such role');
				}

				entity.roles.push(role._id);
				callback();
			});
		}
	}

});
