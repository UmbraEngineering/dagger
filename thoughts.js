
var dagger   = require('dagger.js');




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




dagger.models.require('user');
dagger.models.require('person');





var Person = dagger.models.require('person').model;

// 
// Create the /people endpoint
// 
dagger.endpoint('/people', {
	'get':             Person.crud('read'),
	'get /:id':        Person.crud('read', 'id'),
	'post':            Person.crud('create', preCreate),
	'put|patch':       Person.crud('update'),
	'put|patch /:id':  Person.crud('update', 'id'),
	'delete':          Person.crud('delete'),
	'delete /:id':     Person.crud('delete', 'id')
});

function preCreate(obj, req) {
	if (! obj.requiredThing) {
		throw new dagger.HttpError(400, 'requiredThing is required');
	}

	obj.owner = req.user._id;
	return obj;
}






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





