
var path = require('path');

var root;
try {
	root = global.ROOT || path.dirname(process.mainModule.filename);
} catch (e) {
	root = path.join(__dirname, '../../..');
}

module.exports = {
	ROOT:       root,
	CONFIG:     path.join(root, 'config'),
	MODELS:     path.join(root, 'models'),
	RESOURCES:  path.join(root, 'resources'),
	DAGGER:     path.join(__dirname, '..'),
	MODULES: {
		EXPRESS:   path.dirname(require.resolve('express')),
		SOCKETIO:  path.dirname(require.resolve('socket.io'))
	}
};
