
// 
// Creates the formatted schema object sent to /resource/schema requests
// 

var models = require('../models');

exports.parse = function(schema) {
	var obj = { };
	
	Object.keys(schema).forEach(function(key) {
		obj[key] = typeObject(schema[key]);
	});

	return obj;
};

function typeObject(type) {
	var obj      = { };
	var def      = { };
	var isArray  = false;

	if (typeof type === 'object' && type) {
		if (Array.isArray(type)) {
			isArray = true;
			type = type[0];
			if (typeof type === 'object' && type) {
				handleDetails();
			}
		} else {
			handleDetails();
		}

		function handleDetails() {
			if (Object.keys(type).length) {
				if (type.type) {
					def = type;
					type = def.type;
				} else {
					return {
						type: 'Object',
						tree: parseSchema(type)
					};
				}
			} else {
				type = Object;
			}
		}
	}

	switch (type) {
		case String:
			obj.type = 'String';
			if (def.enum) {
				obj.enum = def.enum.slice()
			}
			if (def.lowercase) {
				obj.lowercase = true;
			}
			if (def.uppercase) {
				obj.uppercase = true;
			}
			if (def.trim) {
				obj.trim = true;
			}
			if (def.match) {
				obj.match = def.match.toString;
			}
		break;
		case Number:
			obj.type = 'Number';
			if (def.min != null) {
				obj.min = def.min;
			}
			if (def.max != null) {
				obj.max = def.max;
			}
		break;
		case Date:
			obj.type = 'Date';
			if (def.expires) {
				obj.expires = def.expires;
			}
		break;
		case Boolean:
			obj.type = 'Boolean';
		break;
		case Array:
			obj.type = 'Array';
		break;
		case Object:
			obj.type = 'Object';
		break;
		case Buffer:
			obj.type = 'Buffer';
		break;
		case models.types.Mixed:
			obj.type = 'Mixed';
		break;
		case models.types.Email:
			obj.type = 'Email';
		break;
		case models.types.Url:
			obj.type = 'Url';
		break;
		case models.types.ObjectId:
			obj.type = 'ObjectId';
			if (def.ref) {
				obj.ref = def.ref;
			}
			if (def.auto) {
				obj.auto = def.auto;
			}
		break;
		default:
			if (isArray) {
				isArray = false;
				obj.type = 'Array';
			}
		break;
	}

	if (isArray) {
		obj.type = '[' + obj.type + ']';
	}

	if (def.index) {
		if (def.index.unique) {
			obj.unique = true;
		} else {
			obj.index = true;
		}
	}

	if (def.protected) {
		obj.protected = true;
	}

	if (def.readonly) {
		obj.readonly = true;
	}

	return obj;
}
