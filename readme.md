# dagger

A Node.js API server framework with Socket.IO support

The sister project of [cloak](https://github.com/UmbraEngineering/cloak).

## Installation

```bash
$ npm install dagger.js
```

## Usage

Dagger is designed so that you can get straight to building your app with very little difficulty and setup.

### Start Building

Your API server application should have the following basic structure:

```
project
|
+--config
|  |
|  +--master.js
|  |
|  +--development.js
|  |
|  \--production.js
|
+--models
|
\--routes
```

The `config` directory contains a master config file with all of your default configuration, and another config file with overrides for each environment you plan to use. The `models` directory contains your models, which are used to automatically build the API endpoints. The `routes` directory is optional, and can contain "resources" which allow you to build custom endpoints not directly tied to a model.


