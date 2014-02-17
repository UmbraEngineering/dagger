
var dagger    = require('dagger.js');
var Endpoint  = dagger.require('endpoint');
var models    = dagger.require('models');
var Person    = models.require('person').model;

var PeopleEndpoint = module.exports = new Endpoint({

	route: '/people',

	// GET /people/schema
	"get /schema": function(req) {
		req.send(200, Person.schemaDescription());
	},

	// GET /people
	"get": function(req) {
		// 
	},

	// GET /people/:id
	"get /:id": function(req) {
		// 
	},

	// POST /people
	"post": function(req) {
		// 
	},

	// PUT/PATCH /people
	"put|patch": function(req) {
		// 
	},

	// PUT/PATCH /people/:id
	"put|patch /:id": function(req) {
		// 
	},

	// DELETE /people
	"delete": function(req) {
		// 
	},

	// DELETE /people/:id
	"delete /:id": function(req) {
		// 
	}

});
