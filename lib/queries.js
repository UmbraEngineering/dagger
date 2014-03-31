
var HttpError = require('./http-meta').HttpError;

exports.buildQuery = function(model, opts) {
	// Build the actual database query
	var query = model
		.find()
		.lean()
		.skip(opts.offset)
		.limit(opts.limit);

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
			throw new HttpError(400, 'filter parameter JSON was malformed')
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

exports.buildFilter = function(query, filter, key) {
	filter = filter[key];

	// Handle $or clauses
	if (key === '$or' || key === '$nor') {
		if (Array.isArray(filter)) {
			query[key.slice(1)](filter);
		}

		// Handle syntax error in $or
		else {
			throw new HttpError(400, '$or clause value must be an array');
		}

		return;
	}

	// Handle $where clauses
	if (key === '$where') {
		query.$where(filter);

		return;
	}

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
};