
var app = require('./index').app;

// 
// Add to the endpoint index whenever a new resource is created
// 
var index = [ ];
require('./resource')._queue.on('*', function(resource) {
	var route = resource.route.path;

	if (route instanceof RegExp) {
		route = route.toString().slice(1, -1).replace('(/.*)?', '/:id?');
	} else {
		route = route.replace('**?', ':id?')
	}

	var schemaRoute = route.replace(':id?', 'schema');
	var schema = (resource.model && app.conf.endpoints.schema) ? schemaRoute : null;

	index.push({
		name: resource.name,
		route: route,
		methods: resource.allow(),
		public: resource.public,
		schema: schema 
	});
});

// 
// Build the index endpoing
// 
var Index = app.Resource.create('index', {

	route: '/',

	public: true,

	get: function(req) {
		req.send(200, {
			endpoints: index
		});
	}

});
