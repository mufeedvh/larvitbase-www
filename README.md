[![Build Status](https://travis-ci.org/larvit/larvitbase-www.svg)](https://travis-ci.org/larvit/larvitbase-www) [![Dependencies](https://david-dm.org/larvit/larvitbase-www.svg)](https://david-dm.org/larvit/larvitbase-www.svg)
[![Coverage Status](https://coveralls.io/repos/github/larvit/larvitbase-www/badge.svg)](https://coveralls.io/github/larvit/larvitbase-www)

# larvitbase-www

Website base framework based on [larvitbase](https://github.com/larvit/larvitbase)

Running the following middlewares:

* [larvitreqparser](https://github.com/larvit/larvitreqparser)

    Parse the request, saving request body and more.

* [larvitrouter](https://github.com/larvit/larvitrouter)

    Routing the request, the result is saved on req.routed
    This also decides if the response should be rendered, depending on if the URL ends with .json or not.
    Rendering is saved in __req.render__ = true/false
    If the request ends in .json, that is stripped off before it is routed to a controller or template, but NOT a static file.

* [send](https://github.com/pillarjs/send)

    Feed a static file as a response, if it is routed and exists.
    If a static file is detected and this middleware is ran; __req.finnished__ is set to true, and no other data should be sent in the respons, not even res.end().

* Run controller

    If a controller is found in the routing, the controller will be executed. Read more details on controllers further down. A controller is not mandatory.

* Render template with [ejs](https://github.com/mde/ejs)

    Ejs will be feeded with __res.data__ as data and the routed template file as template.

* OR if __req.render__ is false OR if no template is found:

    send __res.data__ as a JSON string to the client.

* Run reqParser clean function

## Installation

```bash
npm i larvitbase-www
```

## Basic usage

### index.js

```javascript
const	App	= require('larvitbase-www');

let	app;

app = new Api({
	'baseOptions':	{'httpOptions': 8001},	// sent to larvitbase
	'routerOptions':	{},	// sent to larvitrouter
	'reqParserOptions':	{},	// sent to larvitpeqparser
});

app.start(function (err) {
	if (err) throw err;
});

// Exposed stuff
//app.options	- the options sent in when instanciated
//app.base	- larvitbase instance
//app.router	- larvitrouter instance
//app.reqParser	- larvitreqparser instance

// Shorthands
//app.middleware	shorthand for app.base.middleware and app.options.baseOptions.middleware
```

### controllers/default.js

```javascript
'use strict';

exports = module.exports = function controllerDefault(req, res, cb) {
	res.data.foo	= 'bar';
	cb();
}
```

### controllers/foo.js

```javascript
'use strict';

exports = module.exports = function controllerFoo(req, res, cb) {
	res.data.foo	= 'baz';
	cb();
}
```

### public/templates/default.ejs

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>Default page</title>
	</head>
	<body>
		<h1><%= foo %></h1>
	</body>
</html>
```

### public/templates/foo.ejs

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>Foo page</title>
	</head>
	<body>
		<h1><%= foo %></h1>
	</body>
</html>
```

### public/templates/another.ejs

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>Another page</title>
	</head>
	<body>
		<h1>This page have no controller, just a template</h1>
	</body>
</html>
```

### Summary

This will provide the following:

* Default controller on / (and /default)
  Go to http://localhost:8001/ and you'll see the default template being rendered with the default controller.
* Foo controller and template will render on /foo
* Another page will render, without controller on /another

## res.data by default

By default res.data is set to an object consisting of:

* res.data.global	- will always be at least an empty object
* res.data.global.formFields	- taken directly from req.formFields provided by larvitreqparser
* res.data.global.urlParsed	-

## .json paths

If you provide an URL ending in .json and no such static file exists, larvitbase-www will feed res.data as raw JSON to the client.

For example if you have a controller named __controllers/foo.js__ and you enter the url http://localhost:8001/foo.json in your browser, by default you'll see raw JSON.

## Skip rendering

If __req.render__ is set to boolean false, it will have the same effect as providing a .json path; res.data will be sent directly to the client as raw JSON.

## Stop further execution of middleware, req.finnished

If __req.finnished__ is set to true, the builtin middlewares, including the controller-runner, will be bypassed. This is useful if an error is encountered of if some rate-limiter or other stuff should stop further execution of a request.

## EJS special include()

The EJS instance larvitbase-www is running is patched with a custom include() that uses [larvitfs](https://github.com/larvit/larvitfs) to look for templates.

## 404 and 500; no route found and internal errors

### 404

If no route is found, app.noTargetFound(req, res, cb) is ran. The default noTargetFound() only sets res.statusCode = 404 and writes "404 Not Found" to the client as raw text.

If a template exists named 404 that will be used.

### 500

If a middleware emits an error or something goes wrong in the network stack, app.internalError(req, res, cb) is ran. By default internalError() only sets res.statusCode = 500 and writes "500 Internal Server Error" to the client as raw text.

If a template exists named 500 that will be used.

## Todo

* Set appropriate HTML headers
