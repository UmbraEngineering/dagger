
var oath   = require('oath');
var app    = require('../index').app;
var merge  = require('merge-recursive');

app.models.require('roles');

var AuthEntity = app.models.create('auth-entities', {

	schema: {
		perms: { },
		roles: [{type: app.models.types.ObjectId, ref: 'roles'}]
	}

});
