
module.exports = {

	// 
	// Logging configuration
	// 
	logging: {
		level: ['MESSAGE', 'WARNING', 'ERROR', 'CRITICAL'],
		timestamps: true,
		colorOutput: true
	},

	// 
	// HTTP server configuration
	// 
	http: {
		// If disabled, the server acts as a socket-only server, and all non-socket
		// related requests will fail with a 501 Not Implemented error.
		enabled: true,

		port: 8000,
		address: '0.0.0.0',
		ssl: {
			enabled: false,
			keyFile: './ssl/key',
			certFile: './ssl/cert',
			caFile: './ssl/ca'
		}
	},

	// 
	// Web socket configuration
	// 
	ws: {
		enabled: true,

		// Should socket-based push listeners be allowed
		enablePushSupport: true
	},
	
	// 
	// Redis is used in dagger as a pub-sub event bus for communicating certain events
	// between multiple instances of your application. If you only intend on running a
	// single instance, you can disable this.
	// 
	redis: {
		enabled: true,
		url: 'redis://localhost',
		channel: 'dagger',
	},

	// 
	// MongoDB is used for storing all of the persistent data for your application.
	// 
	mongodb: {
		url: 'mongodb://localhost'
	}

};
