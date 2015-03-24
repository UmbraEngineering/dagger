
var path = require('path');

var root;
try {
	root = process.env.ROOT_DIR || path.dirname(process.mainModule.filename);
} catch (e) {
	root = path.join(__dirname, '../../..');
}

exports = module.exports = {
	root:       root,
	config:     path.join(root, 'config'),
	models:     path.join(root, 'models'),
	endpoints:  path.join(root, 'endpoints'),
	dagger:     path.join(__dirname, '..'),
	modules: {
		scoketio:  path.dirname(require.resolve('socket.io'))
	}
};

exports.resolve = function(from, to) {
	if (arguments.length === 1) {
		to = from;
		from = 'root';
	}

	return path.resolve((exports[from] || from), to);
};
