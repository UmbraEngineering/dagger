
require('dagger.js')({

	bootstrap: [
		require('./bootstrap/uncaught-errors')({ exitOnError: true })
	],
	
	middleware: [
		// require('./middleware/auth')
	]

});
