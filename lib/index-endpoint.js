
var app = require('./index').app;

// 
// Add to the endpoint index whenever a new resource is created
// 
var index = [ ];
require('./resource')._queue.on('*', function(resource) {
	var route = resource.route.path;
	var schemaRoute = route.replace(':' + resource.name + 'id?', 'schema');
	var schema = (resource.model && app.conf.app.schemaEndpoints) ? schemaRoute : null;

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
