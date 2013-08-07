
var app = require('dagger.js').app;

app.models.create('role', {

	schema: {
		name: String,
		perms: [String]
	}

});
