
var dagger   = require('dagger.js');
var People   = require('./models/people');

dagger({

	bootstrap: [
		require('./src/bootstrap/init-the-thing'),
		require('./src/bootstrap/init-the-other-thing')
	],

	postInit: function() {
		this.socketServer.io.adapter(socketioRedis({
			// 
		}));
	},

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

});






Person.auth(dagger.model.auth.Basic);

people.get(Person.crud('read'));

people.get('/:id', Person.crud('read', 'id'));

people.post(Person.crud('create'));






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







{
	http: {
		port: 8000,
		address: '0.0.0.0'
	},
	ssl: {
		enabled: false,
		ca: null,
		caFile: null,
		key: null,
		keyFile: null,
		cert: null,
		certFile: null
	},
	ws: {
		enabled: true,
		enableListeners: true
	}
}





