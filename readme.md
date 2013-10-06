# dagger

A Node.js RESTful API server framework with Socket.IO support

The sister project of [cloak](https://github.com/UmbraEngineering/cloak).

## Installation

```bash
$ npm install dagger.js
```

## Usage

Dagger is designed so that you can get straight to building your app with very little difficulty and setup. It is built on top of tested and well supported technologies such as [Express](http://expressjs.com/), [Socket.io](http://socket.io/), and [MongoDB](http://www.mongodb.org/).

_Full documentation will be done when the first alpha release is ready_

### Start Building

Your API server application should have the following basic structure:

```
project
+--config
|  +--master.js
|  +--development.js
|  +--production.js
+--models
+--routes
+--start.js
```

The `config` directory contains a master config file with all of your default configuration, and another config file with overrides for each environment you plan to use. The `models` directory contains your models, which are used to automatically build the API endpoints. The `routes` directory is optional, and can contain "resources" which allow you to build custom endpoints not directly tied to a model.

Starting up the project is easy. Your start.js file should look something like this:

###### ./start.js

```javascript
require('dagger.js').initialize(__dirname);
```

You then start the server with a command like this:

```bash
$ NODE_ENV=development node start.js
```

### Models

Models are designed using a beefed up [mongoose](http://mongoosejs.com/) system. A basic model in Dagger looks something like this:

###### ./models/posts.js

```javascript
var app = require('dagger.js').app;

var ObjectId = app.models.types.ObjectId;

// We use these in the schema below, so load them
app.models.require('users');
app.models.require('comments');

//
// Define our posts model.
//
var Post = app.models.create('posts', {
	
	// This is a mongoose schema with some extra features supported
	schema: {
		title: String,
		body: String,
		created: Date,
		updated: Date,
		author: {type: ObjectId, ref: 'users'},
		comments: [{type: ObjectId, ref: 'comments'}]
	},

	hooks: {
		// When we change the title or body, set the updated date
		'before::save': function(next) {
			if (this.isModified('title') || this.isModified('body')) {
				this.updated = Date.now();
			}
			next();
		},

		// When we create a new Post, set the created/updated dates
		'before::create': function(next) {
			this.created = Date.now();
			this.updated = Date.now();
			next();
		}
	}

});
```

With just that, you have RESTful endpoints defined for all of the basic CRUD operations, plus a little extra:

```
GET /posts
GET /posts/:postid
HEAD /posts
HEAD /posts/:postid
POST /posts
PUT /posts/:postid
PATCH /posts/:postid
DELETE /posts/:postid
OPTIONS /posts
GET /posts/schema
```

It also defines sub-resource routes, like the following:

```
GET /posts/:postid/author
GET /posts/:postid/comments
GET /posts/:postid/comments/:commentid

etc...
```
