
var User   = require('./user');
var Model  = require('dagger.js').require('model');

// 
// Define an example {Person < Model} class
// 
var Person = module.exports = Model.create('Person', {
	
	// Plural name for this model, used as the route URI; defaults to
	// {this.name.toLowerCase() + 's'}
	route: 'people',

	// Load the timestamps plugin, adding created and updated fields
	useTimestamps: true,

	// Define the data schema
	schema: {
		name: String,
		email: Model.Types.Email,
		user: {type: Model.Types.ObjectId, ref: 'User', readonly: true}
	},

	// Hook into mongoose to do some extra processing
	hooks: {
		'before::save': function() {
			// 
		}
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
