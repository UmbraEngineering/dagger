
var dagger   = require('dagger.js');
var People   = require('./models/people');

dagger(require('./config'), {

	middleware: function() {
		this.use(someAuthModule);
		this.use(this.router);
	}

});

// 
// Create the /people endpoint
// 
dagger.endpoint('/people', {

	// 
	// GET /people/:id
	// 
	'get /:id': function(req) {
		People.findById(req.params.id, function(err, person) {
			if (err) {
				return req.error(404, 'Could not find person with ID "' + req.params.id + '"');
			}

			req.send(200, person.serialize());
		});
	},

	// 
	// 
	// 
	'post': function(req) {
		People.create()
	}

})






var people = module.exports = dagger.endpoint('/people');

people.get('/:id', function(req) {
	// 
});

people.post(function(req) {
	// 
});

people.put('/:id', function(req) {
	// 
});

people.delete('/:id', function(req) {
	// 
});




dagger.endpoint('/people')
	.on('put|patch /:id', function(req) {
		// 
	})
	.get('/:id', function(req) {
		// 
	})
	.post(function(req) {
		// 
	})













