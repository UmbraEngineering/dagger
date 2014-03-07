
var models = require('dagger.js').require('models');

// 
// Define the Person schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('Person', PersonSchema)`)
// as that is handled automatically by dagger's model module.
// 
var PersonSchema = module.exports = new models.Schema({
	name: { type: String, required: true },
	email: { type: String, required: true, index: {unique: true} },
	gender: {
		type: String,
		enum: ['Male', 'Female', 'Other', 'Undisclosed']
	},
	children: [{ type: models.types.ObjectId, ref: 'person' }]
});

// 
// Define a static method on the Person model
// 
// If you need to access the model object itself (such as to query other documents)
// inside of this file, you can use `exports.model`, as seen here.
// 
PersonSchema.statics.findByEmail = function(email, callback) {
	return exports.model.find({email: email}, callback);
};

// 
// Define an instance method
// 
PersonSchema.methods.sendEmail = function(subject, body) {
	return require('mailer').send({
		to: this.email,
		from: 'noreply@example.com',
		subject: subject,
		text: body
	});
};
