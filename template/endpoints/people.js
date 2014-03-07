
var dagger     = require('dagger.js');
var models     = dagger.require('models');
var Endpoint   = dagger.require('endpoint');
var HttpError  = dagger.require('http-meta').HttpError;
var Person     = models.require('person').model;

var PeopleEndpoint = module.exports = new Endpoint({

	route: '/people',

	// 
	// GET /people/schema
	// 
	"get /schema": function(req) {
		req.send(200, Person.schemaDescription());
	},

	// 
	// GET /people
	// 
	"get": function(req) {
		Person.findByQuery(req.query)
			.then(
				function(people) {
					req.send(200, people.map(Person.serialize));
				},
				function(err) {
					(new HttpError(err)).send(req);
				}
			);
	},

	// 
	// GET /people/:id
	// 
	"get /:id": function(req) {
		Person.findById(req.params.id).exec()
			.then(
				function(person) {
					if (! person) {
						return (new HttpError(404, 'Document not found')).send(req);
					}

					req.send(200, Person.serialize(person));
				},
				function(err) {
					// This means that the param ID was not a valid ObjectId
					if (err.name === 'CastError' || err.path === '_id') {
						return (new HttpError(404, 'Document not found')).send(req);
					}

					(new HttpError(err)).send(req);
				}
			);
	},

	// 
	// POST /people
	// 
	"post": function(req) {
		Person.create(req.body)
			.then(
				function(person) {
					req.send(200, Person.serialize(person));
				},
				function(err) {
					(new HttpError(err)).send(req);
				}
			);
	},

	// 
	// PUT/PATCH /people
	// 
	"put|patch": function(req) {
		// 
	},

	// 
	// PUT/PATCH /people/:id
	// 
	"put|patch /:id": function(req) {
		Person.findById(req.params.id).exec()
			.then(function(person) {
				if (! person) {
					return (new HttpError(404, 'Document not found')).send(req);
				}

				// 
				// NOTE: Any kind of authorization should be handled here
				// 

				person.set(req.body);
				return when.saved(person);
			})
			.then(
				function(person) {
					req.send(200, person);
				},
				function(err) {
					(new HttpError(err)).send(req);
				}
			);
	},

	// 
	// DELETE /people
	// 
	"delete": function(req) {
		// 
	},

	// 
	// DELETE /people/:id
	// 
	"delete /:id": function(req) {
		// 
	}

});
