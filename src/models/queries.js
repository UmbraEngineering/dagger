
var HttpError = require('../http/error');

// 
// Build a mongoose query object for the given model and filter request
// 
// @param {model} the model to query
// @param {filter} the whole filter object from the request
// @return object
// 
exports.buildQuery = function(model, opts) {
	// Build the actual database query
	var query = model
		.find()
		.skip(opts.offset)
		.limit(opts.limit);

	// Query for lean objects if requested
	if (opts.lean) {
		query.lean();
	}

	// Handle selecting fields
	if (opts.fields) {
		query.select(opts.fields);
	}

	// Handle field population
	if (opts.populate) {
		query.populate(opts.populate);
	}

	// Handle filtering
	if (opts.filter) {
		try {
			opts.filter = JSON.parse(opts.filter);
		} catch (e) {
			throw new HttpError(400, 'filter parameter JSON was malformed');
		}
		
		try {
			Object.keys(opts.filter).forEach(
				exports.buildFilter.bind(this, query, opts.filter)
			);
		} catch (e) {
			throw new HttpError(e);
		}
	}

	// Handle sorting
	if (opts.sort) {
		query.sort(opts.sort);
	}

	return query;
};

// -------------------------------------------------------------

var simpleQueries = [
	'$ne', '$gt', '$lt', '$gte', '$lte', '$in', '$nin',
	'$all', '$size', '$elemMatch', '$exists', '$mod',
	'$near', '$nearSphere'
];

// 
// Builds an individual filter clause for a query
// 
// @param {query} the query object
// @param {filter} the whole filter object from the request
// @param {key} the filter key we're currently working on
// @return void
// 
exports.buildFilter = function(query, filter, key) {
	filter = filter[key];

	switch (key) {
		// Handle $or clauses
		case '$or':
		case '$nor':
			orClause(query, filter, key);
		break;

		// Handle $where clauses
		case '$where':
			query.where(filter);
		break;

		// Handle everything else
		default:
			complexQuery(query, filter, key);
		break;
	}
};

// 
// Used to handle $or/$nor clauses in queries
// 
// @param {query} the query object
// @param {filter} the filter object
// @param {key} the filter key we're currently working on
// @return void
// 
function orClause(query, filter, key) {
	if (! Array.isArray(filter)) {
		throw new HttpError(400, '$or clause value must be an array');
	}

	query[key.slice(1)](filter);
}

// 
// Used to handle non-simple selections
// 
// @param {query} the query object
// @param {filter} the filter object
// @param {key} the filter key we're currently working on
// @return void
// 
function complexQuery(query, filter, key) {
	// Start the query...
	query.where(key);

	// Handle exact value queries
	if (typeof filter === 'string') {
		query.equals(filter);
	}

	// Handle more specific cases
	else if (typeof filter === 'object' && filter) {
		// Simple queries
		simpleQueries.forEach(function(op) {
			if (filter[op] != null) {
				query[op.slice(1)](filter[op]);
			}
		});

		// Geometry Queries
		if (filter.$geoWithin != null) {
			query.within.geometry(filter.$geoWithin);
		}
		if (filter.$geoIntersects != null) {
			query.within.geometry(filter.$geoIntersects);
		}

		// Regex Queries
		if (filter.$regex != null) {
			var flags = '';
			var index = null;
			var pattern = filter.$regex;
			
			if (pattern[0] === '/') {
				pattern = pattern.slice(1);
				index = pattern.lastIndexOf('/');
				flags = pattern.slice(index + 1);
				pattern = pattern.slice(0, index);
			}

			query.regex(new RegExp(pattern, flags));
		}
	}
}
