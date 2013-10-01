
var oath   = require('oath');
var async  = require('async');
var app    = require('../index').app;

// 
// Fetches a scope chain for a complex URI given the URI segments array, eg.
// 
//   GET /posts/123/comments/234/author/comments
// 
// Given as this array:
// 
//   ["posts", "123", "comments", "234", "author", "comments"]
// 
// Does something like this (simplified chaining, obviously)
//   
//   Post.find(123).comments.find(234).author.comments
// 
// And will return a scope chain:
//   
//   [ {type: "model",  model: Post},
//     {type: "ref",    model: Post,     value: post},
//     {type: "list",   model: Comment,  value: [comment, comment, comment]},
//     {type: "ref",    model: Comment,  value: comment},
//     {type: "ref",    model: User,     value: author},
//     {type: "list",   model: Comment,  value: [comment, comment]}
//   ]
// 

module.exports = function(model, uri) {
	var promise = new oath();

	var uri = uri.split('/');
	var scope = {type: 'model', model: model};
	var scopeChain = [ scope ];

	// If there is no uri[2], then this is a top-level list endpoint
	if (! uri[2]) {
		process.nextTick(function() {
			promise.resolve(scopeChain);
		});

		return promise.promise;
	}

	// Build the scope chain
	async.forEachSeries(uri.slice(2),
		function(segment, next) {
			var model;

			switch (scope.type) {
				// GET /foos/{123}
				case 'model':
					if (segment === 'schema') {
						scopeChain.push({
							type: 'schema',
							model: scope.model,
							value: scope.model.resource._schema()
						});

						return next();
					}

					model = scope.model;
					model.findById(segment, function(err, obj) {
						if (err) {
							return next(new app.Resource.HttpError(500, err));
						}

						if (! obj) {
							return next(new app.Resource.HttpError(404, 'Document not found'));
						}

						scopeChain.push(scope = {
							type: 'ref',
							value: obj.sanitize(),
							model: model
						});

						next();
					});
					
				break;

				// GET /foos/123/{property}
				case 'ref':
					var type = scope.model.schema.path(segment).options.type;
					
					// Handle arrays
					if (type === Array) {
						type = type[0];
						
						// Handle ref arrays, eg. [{type: ObjectId, ref: "..."}]
						if (typeof type === 'object' && type && type.ref) {
							model = app.models.require(type.ref)();
							model.find({ _id: {$in: scope.value[segment]} }, function(err, objs) {
								if (err) {
									return next(new app.Resource.HttpError(500, err));
								}

								objs = objs || [ ];
								scopeChain.push(scope = {
									type: 'list',
									value: objs.map(function(obj) {
										return obj.sanitize()
									}),
									model: model
								});

								next();
							});
						}

						// Handle value arrays, eg. [String]
						else {
							scopeChain.push(scope = {
								type: 'value',
								value: scope.value[segment]
							});

							next();
						}
					}

					// Handle ref properties
					else if (typeof type === 'object' && type && type.ref) {
						model = app.models.require(type.ref)();
						model.findById(scope.value[segment], function(err, obj) {
							if (err) {
								return next(new app.Resource.HttpError(500, err));
							}

							objs = objs || [ ];
							scopeChain.push(scope = {
								type: 'ref',
								value: obj.sanitize(),
								model: model
							});

							next();
						});
					}

					// Handle value properties
					else {
						scopeChain.push(scope = {
							type: 'value',
							value: scope.value[segment]
						});

						next();
					}
				break;

				// GET /foos/123/list-property/{234}
				case 'list':
					if (segment === 'schema') {
						scopeChain.push({
							type: 'schema',
							model: scope.model,
							value: scope.model.resource._schema()
						});

						return next();
					}

					var result;
					scope.value.some(function(obj) {
						if (obj._id === segment) {
							result = obj;
							return true;
						}
					});

					if (! result) {
						return next(new app.Resource.HttpError(404, 'Document not found'));
					}

					scopeChain.push(scope = {
						type: 'ref',
						value: result,
						model: scope.model
					});
				break;

				// GET /foos/123/value-property/{...}
				case 'value':
				// GET /foos/schema/{...}
				case 'schema':
					next(new app.Resource.HttpError(400, 'Invalid request URI; Unexpected URI segment "' + segment + '"'));
				break;
			}
		},
		function(err) {
			if (err) {
				promise.reject(err);
			}

			promise.resolve(scopeChain);
		});

	return promise.promise;
};
