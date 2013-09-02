
var oath  = require('oath');
var app   = require('../index').app;

var Role = app.models.create('roles', {

	schema: {
		name: String,
		// 
		// {
		//   users: {create: false, read: true, update: 'ifOwner', delete: false},
		//   posts: {create: false, read: true, update: false,     delete: false}
		// }
		// 
		// Anytime a string is given as a permission value (as oposed to a boolean)
		// the string is called as a method on the user model with the resource in question
		// as a parameter. This allow adding granular control of resource permissions
		// such as the example above where users are only allowed to update a user if
		// they "own" my resource.
		// 
		perms: { }
	},

	methods: {
		// 
		// Get a permissions object
		// 
		toPerms: function() {
			return this.toObject({
				transform: function(doc, ret, opts) {
					return ret.perms;
				}
			});
		},

		// 
		// Check if the user has a given permission
		// 
		hasPermission: function(perm) {
			var args = Array.prototype.slice.call(arguments, 1);

			perm = perm.split('.');
			
		}
	}

});
