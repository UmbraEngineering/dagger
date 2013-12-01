
var User   = require('./user');
var Model  = require('dagger.js').require('model');

// 
// Define an example {Person < Model} class
// 
var Person = module.exports = Model.extend({

	// Singular name for this model, used when defining the model in mongoose
	name: 'Person',
	
	// Plural name for this model, used as the route URI
	route: 'people',

	// Define the data schema
	schema: {
		name: String,
		email: Model.Types.Email,
		user: {type: Model.Types.ObjectId, ref: 'User', readonly: true}
	}

});

// --------------------------------------------------------

var bob = new Person({
	name: 'Bob',
	email: 'bob@example.com'
});

bob.save(function() {
	// 
});
