
require('dagger.js')({
	
	middleware: [
		require('./auth')
	]

});
