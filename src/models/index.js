
var dagger         = require('../index');
var paths          = require('../paths');
var conf           = require('../config');
var mongoose       = require('./mongoose');
var HttpError      = require('../http/error');
var queries        = require('./queries');
var AllowAll       = require('./authorization/allow-all');
var Promise        = require('promise-es6').Promise;
var hasDuplicates  = require('../utils/has-duplicates');
var arrayFind      = require('../utils/array-find');

var eventBus = conf.redis.enabled
	? require('./redis-bus')
	: require('./memory-bus');

exports.Schema  = mongoose.Schema;
exports.types   = mongoose.Schema.Types;

exports.modelCache = { };

// 
// Loads and returns a specific model
// 
// @param {model} the model path relative to the models directory
// 
exports.require = function(model) {
	if (! exports.modelCache[model]) {
		var name = model.split('/').join('-');
		var path = paths.resolve('models', model);
		var cached = exports.modelCache[model] = require(path);

		Object.defineProperty(cached, 'model', {
			enumerable: true,
			configurable: true,
			// Use a getter here so that the model is only defined the first time it is accessed, as
			// opposed to creating the model when the model's module is loaded. This allows requiring
			// and accessing schemas freely without initializing models, making it easier to make sure
			// schemas are declared in the correct order when dealing with circular references.
			get: function() {
				// Remove the no longer needed getter
				delete cached.model;
				// Redefine cached.model to be the generated model object
				Object.defineProperty(cached, 'model', {
					enumerable: true,
					configurable: false,
					writeable: false,
					value: exports.create(name, cached.schema, cached.auth)
				});

				return cached.model;
			}
		});
	}

	return exports.modelCache[model];
};

// 
// Creates a new mongoose model from a schema after adding some internal static methods
// 
// @param {name} the model name
// @param {schema} the schema as it has been defined so far
// @param {auth} the authorization model to use
// @return object
// 
exports.create = function(name, schema, auth) {
	// If no authorization model is defined, default to allowing everything
	auth = auth || new AllowAll();

	// Mark the model as new if it is
	schema.pre('save', function(done) {
		this.wasNew = this.isNew;
		done();
	});

	if (conf.ws.enabledListeners) {
		// Listen for save events so we can put an event on the event bus
		schema.post('save', function() {
			publishEvent(this.wasNew ? 'create' : 'update', this);
		});
		
		// Listen for remove events so we can put an event on the event bus
		schema.post('remove', function() {
			publishEvent('remove', this);
		});

		// Start listening for a specific event on the event bus
		schema.statics.subscribe = function(event, id, callback) {
			if (typeof id === 'function') {
				callback = id;
				id = '*';
			}

			eventBus.on(eventName(event, id), callback);
		};

		// Stop listening for a specific event on the event bus
		schema.statics.unsubscribe = function(event, id, callback) {
			if (typeof id === 'function') {
				callback = id;
				id = '*';
			}

			eventBus.off(eventName(event, id), callback);
		};
	}

	function publishEvent(event, inst) {
		var json = model.serialize(inst);
		eventBus.emit(eventName(event, json._id), json);
	}

	function eventName(event, id) {
		return [name, event, id].join(':');
	}

// -------------------------------------------------------------

	// 
	// Add the schema description method, but only if one was not already defined
	// 
	// @param {opts} optional; additional options
	// @return object
	// 
	if (! schema.static.schemaDescription) {
		schema.statics.schemaDescription = function(opts) {
			opts = opts || { };
			opts.exclude = opts.exclude || [ ];

			var result = { };

			Object.keys(schema.paths).forEach(function(key) {
				if (opts.exclude.indexOf(key) >= 0) {
					return;
				}

				var path = schema.paths[key];
				var desc = result[key] = { };
				
				if (path.instance) {
					desc.type = path.instance;
				} else {
					var type = path.options.type;
					var isArray = Array.isArray(type);
					
					if (isArray) {
						type = type[0];
					}

					type = type.toString();
					type = type.slice(9, type.indexOf('('));

					if (isArray) {
						type = '[' + type + ']';
					}

					desc.type = type;
				}

				// Normalize the string format for object id fields
				if (desc.type === 'ObjectID') {
					desc.type = 'ObjectId';
				} else if (desc.type === '[ObjectID]') {
					desc.type = '[ObjectId]';
				}

				Object.keys(path.options).forEach(function(opt) {
					if (opt === 'type') {return;}

					desc[opt] = path.options[opt];
					if (desc[opt] === undefined) {
						desc[opt] = null;
					}
				});

				// Make sure that the version number is correctly identified as auto-generated
				if (key === '__v') {
					desc.auto = true;
				}

				// Show only messages for validators
				if (desc.validate) {
					desc.validate = desc.validate.map(function(validation) {
						return validation.msg || validation;
					});
				}
			});

			if (opts.include) {
				Object.keys(opts.include).forEach(function(key) {
					result[key] = opts.include[key];
				});
			}

			return result;
		};
	}

	// 
	// Add the find by query method, but only if one was not already defined
	// 
	// @param {qs} the parsed querystring data for the request
	// @param {modify} a modifier function to mutate the constructed query before running
	// @return promise
	// 
	if (! schema.statics.findByQuery) {
		schema.statics.findByQuery = function(qs, modify) {
			var query = queries.buildQuery(model, {
				offset: qs.offset || 0,
				limit: qs.limit || 10,
				fields: qs.fields,
				populate: (qs.populate && qs.populate.split(',')),
				filter: qs.filter,
				sort: qs.sort
			});

			if (modify) {
				modify(query);
			}

			return query.exec();
		};
	}

	// 
	// Add the serialize method, but only if one was not already defined
	// 
	// @param {obj} the mongoose object to serialize
	// @return object
	// 
	if (! schema.statics.serialize) {
		schema.statics.serialize = function(obj) {
			if (obj.toObject) {
				obj = obj.toObject();
			}
			return obj;
		};
	}

// -------------------------------------------------------------

	// 
	// Returns a method for creating basic crud functions for this model
	// 
	// @param {crudMethod} the crud method ("create", "read", "update", or "destroy")
	// @param {opts} options for things such as idKeys, and update methods
	// @return function
	// 
	if (! schema.statics.crud) {
		schema.statics.crud = function(crudMethod, opts) {
			opts = opts || { };
			switch (crudMethod) {
				case 'create':
					return crudCreate(opts);
				case 'read':
					return opts.idKey ? crudReadDetail(opts.idKey) : crudReadList;
				case 'update':
					return crudUpdate(opts);
				case 'delete':
					return opts.idKey ? crudDeleteDetail(opts.idKey) : crudDeleteList;
			}
		};
	}

	// 
	// The crud read method for list endpoints, looks up and returns
	// a list of documents for the model based on the given query
	// 
	// @param {req} the request object
	// @return void
	// 
	function crudReadList(req) {
		var page = 0;
		var docs = [ ];
		var start = req.query.offset || 0;
		var pageSize = req.query.limit || 10;

		Promise
			// Keep fetching docs until we have the amount requested
			.while(needDocs)
			.do(findChunk)
			.then(function() {
				docs = docs.slice(0, pageSize);

				var meta = {
					limit: req.query.limit || 10,
					offset: req.query.offset || 0,
					count: docs.length
				};

				req.send(200, meta, docs.map(model.serialize));
			})
			.catch(
				HttpError.catch(req)
			);

		function needDocs() {
			return docs.length < pageSize;
		}

		function findChunk(_break) {
			return model.findByQuery(req.query, paginate)
				.then(function(objs) {
					// If there are no more matches, stop querying
					if (! objs || ! objs.length) {
						return _break();
					}

					// Check for authorization on each document
					return auth.readList(objs, req);
				})
				.then(function(authed) {
					// Add only authorized docs to the list of results
					docs.push.apply(docs, authed);
				});
		}

		function paginate(query) {
			query.skip(start + (pageSize * page++));
		}
	}

	// 
	// The crud read method for detail endpoints, looks up and returns
	// a single document for the model
	// 
	// @param {idKey} the property name where the id can be found
	// @return function
	// 
	function crudReadDetail(idKey) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			var doc;
			var id = req.params[idKey];

			// Look up the requested document
			model.findById(id)
				.exec()
				.then(function(obj) {
					// Make sure we found something
					if (! obj) {
						throw new HttpError(404, 'Document not found');
					}

					doc = obj;

					// Authorize the user to take this action
					return auth.readDetail(doc, req);
				})
				.then(function(authorized) {
					// If the user is not authorized, send back a 401
					if (! authorized) {
						throw new HttpError(401, 'Not authorized');
					}

					req.send(200, model.serialize(doc));
				})
				.catch(
					HttpError.catch(req)
				);
		};
	}

	// 
	// The crud create method, creates a new document for the model
	// 
	// @param {preCreate} a pre-creation validator/constructor function
	// @return function
	// 
	function crudCreate(opts) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			opts.preCreate = opts.preCreate || function(obj) {
				return obj;
			};

			auth.createDetail(req.body)
				.then(function(authorized) {
					if (! authorized) {
						throw new HttpError(401, 'Not authorized');
					}

					return opts.preCreate(req.body, req);
				})
				.then(model.create.bind(model))
				.then(function(doc) {
					var meta = { };
					if (opts.location) {
						var loc = opts.location.replace('#', doc._id);
						meta.location = loc;
						req.setHeader('Location', loc);
					}

					req.send(201, meta, model.serialize(doc));
				})
				.catch(
					HttpError.catch(req)
				);
		};
	}

	// 
	// Chooses the appropriate update method for a crud update call
	// 
	// @param {opts} an opts object with idKey (optional) and method
	// @return function
	// 
	function crudUpdate(opts) {
		opts.method = opts.method || 'patch';

		if (opts.method === 'replace') {
			throw new Error('Replacement style updates not supported in this version of dagger');
			// return opts.idKey ? crudUpdateDetailReplace(opts.idKey) : crudUpdateListReplace;
		}

		else if (opts.method === 'patch') {
			return opts.idKey ? crudUpdateDetailPatch(opts.idKey) : crudUpdateListPatch;
		}

		else {
			throw new Error('Invalid value for update method; Must be "replace" or "patch".');
		}
	}

	// 
	// Updates the given document with the given updates
	// 
	// @param {doc} the document to update
	// @param {update} the update request
	// @return promise
	// 
	function patchDocument(doc, update) {
		var ignore = [ '_id', '__v' ];

		Object.keys(update).forEach(function(key) {
			if (ignore.indexOf(key)) {
				return;
			}
			
			doc[key] = update[key];
		});

		return doc.save();
	}

	// 
	// A wrapper for running list updates
	// 
	// @param {req} the request object
	// @param {updater} a function to run the actual updates
	// @return void
	// 
	function crudUpdateList(req, updater) {
		var docs;
		var objs = req.body;

		if (! Array.isArray(objs) || ! objs.length) {
			return (new HttpError(400, 'Request body must be an array of documents')).send(req);
		}

		var objIds = objs.map(function(obj) {
			return obj._id;
		});

		if (hasDuplicates(objIds)) {
			return (new HttpError(400, 'Request cannot contain duplicate documents')).send(req);
		}

		model.find({ _id: {$in: objIds} }).exec()
			.then(function(_docs) { docs = _docs; })
			.then(function() {
				if (! docs) {
					throw new HttpError(404, 'Document(s) not found');
				}

				if (docs.length < objs.length) {
					throw new HttpError(404, 'Document(s) not found');
				}

				return auth.updateList(docs, req);
			})
			.then(function(authed) {
				if (authed.length < docs.length) {
					throw new HttpError(401, 'Not authorized');
				}

				var promises = docs.map(function(doc) {
					var update = arrayFind(objs, function(obj) {
						return obj._id === doc._id;
					});

					return updater(doc, update);
				});

				return Promise.all(promises);
			})
			.then(function(docs) {
				req.send(200, docs.map(model.serialize));
			})
			.catch(
				HttpError.catch(req)
			);
	}

	// 
	// Crud update method, replaces the given documents in the database completely
	// with the given versions; a PUT operation
	// 
	// @param {req} the request object
	// @return void
	// 
	/*
	function crudUpdateListReplace(req) {
		crudUpdateList(req, function(doc, update) {
			// 
		});
	}
	*/

	// 
	// Crud update method, updates the given documents with the attributes in the
	// given versions; a PATCH operation
	// 
	// @param {req} the request object
	// @return void
	// 
	function crudUpdateListPatch(req) {
		crudUpdateList(req, patchDocument);
	}

	// 
	// Crud update method, replace the given document in the database completely
	// with the given version; a PUT operation
	// 
	// @param {idKey} the property name where the id can be found
	// @return function
	// 
	/*
	function crudUpdateDetailReplace(idKey) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			// 
		};
	}
	*/

	// 
	// Crud update method, updates the given document with the attributes in the
	// given version; a PATCH operation
	// 
	// @param {idKey} the property name where the id can be found
	// @return function
	// 
	function crudUpdateDetailPatch(idKey) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			var doc;
			var id = req.params[idKey];

			model.findById(id).exec()
				.then(function(_doc) { doc = _doc; })
				.then(function() {
					if (! doc) {
						throw new HttpError(404, 'Document not found');
					}

					return auth.updateDetail(doc, req);
				})
				.then(function(authed) {
					if (! authed) {
						throw new HttpError(401, 'Not authorized');
					}

					return patchDocument(doc, req.body);
				})
				.then(function(doc) {
					req.send(200, model.serialize(doc));
				})
				.catch(
					HttpError.catch(req)
				);
		};
	}

	// 
	// The crud delete list method, deletes the given documents from the database
	// 
	// @param {req} the request object
	// @return void
	// 
	function crudDeleteList(req) {
		var docs;
		var ids = req.body;

		if (! Array.isArray(ids) || ! ids.length) {
			return (new HttpError(400, 'Request body must be an array of object ids')).send(req);
		}

		model.find({ _id: {$in: ids} }).exec()
			.then(function(_docs) { docs = _docs; })
			.then(function() {
				if (! docs || docs.length < ids.length) {
					throw new HttpError(404, 'Document(s) not found');
				}

				return auth.deleteList(docs, req);
			})
			.then(function(authed) {
				if (authed.length < ids.length) {
					throw new HttpError(401, 'Not authorized');
				}

				var promises = docs.map(function(doc) {
					return doc.remove();
				});

				return Promise.all(promises);
			})
			.then(function() {
				req.send(200, {
					message: 'Documents deleted successfully'
				});
			})
			.catch(
				HttpError.catch(req)
			);
	}

	// 
	// The crud delete detail method, deletes the given document from the database
	// 
	// @param {idKey} the property name where the id can be found
	// @return function
	// 
	function crudDeleteDetail(idKey) {
		// 
		// @param {req} the request object
		// @return void
		// 
		return function(req) {
			var doc;
			var id = req.params[idKey];

			model.findById(id).exec()
				.then(function(_doc) { doc = _doc; })
				.then(function() {
					if (! doc) {
						throw new HttpError(404, 'Document not found');
					}

					return auth.deleteDetail(doc, req);
				})
				.then(function(authed) {
					if (! authed) {
						throw new HttpError(401, 'Not authorized');
					}

					return doc.remove();
				})
				.then(function() {
					req.send(200, {
						message: 'Document deleted successfully'
					});
				})
				.catch(
					HttpError.catch(req)
				);
		};
	}

// -------------------------------------------------------------

	// Make sure we have the model encapsulated here so it can be referenced in these methods
	var model = mongoose.model(name, schema);
	return model;
};
