
var oath   = require('oath');
var app    = require('../index').app;
var merge  = require('merge-recursive');

app.models.require('roles');

var verbs = ['create', 'read', 'update', 'delete'];

var AuthEntity = app.models.create('auth-entities', {

	// Do not directly expose authentities. These should only ever be accessed via users.
	expose: false,

	schema: {
		perms: { },
		roles: [{type: app.models.types.ObjectId, ref: 'roles'}]
	}

});
