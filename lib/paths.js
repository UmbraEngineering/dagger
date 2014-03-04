
var path = require('path');

var root;
try {
	root = global.ROOT || path.dirname(process.mainModule.filename);
} catch (e) {
	root = path.join(__dirname, '../../..');
}

exports = module.exports = {
	ROOT:       root,
	CONFIG:     path.join(root, 'config'),
	MODELS:     path.join(root, 'models'),
	ENDPOINTS:  path.join(root, 'endpoints'),
	DAGGER:     path.join(__dirname, '..'),
	MODULES: {
		EXPRESS:   path.dirname(require.resolve('express')),
		SOCKETIO:  path.dirname(require.resolve('socket.io'))
	}
};

exports.resolve = function(from, to) {
	if (arguments.length === 1) {
		to = from;
		from = 'ROOT';
	}

	return path.resolve((exports[from] || from), to);
};
