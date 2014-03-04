
var queries   = require('./queries');
var Resource  = require('../resource');

var queryDefaults = {
	limit: 20,
	offset: 0,
	sort: null,
	fields: null,
	populate: null,
	filter: null
};

var BaseEndpoint = module.exports = Resource.extend({

	initialize: function(opts) {
		this._super(opts);

		this.mong = this.model.model;
		this.allowHttp = this.model.allowHttp;
		this.allowSocket = this.model.allowSocket;
	},

	buildQuery: function(opts) {
		opts = merge({ }, queryDefaults, opts || { });
		return queries.buildQuery(this.mong, opts);
	}

});
