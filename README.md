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

* Run reqparser clean function

## Installation

```bash
npm i larvitbase-www
```

## Basic usage

In the file index.js:

```javascript
const App = require('larvitbase-www');

let app;

app = new Api({
	'lBaseOptions':	{'httpOptions': 8001},	// sent to larvitbase
	'routerOptions':	{},	// sent to larvitrouter
	'reqParserOptions': {}, // sent to larvitReqParser
});

app.start(function (err) {
	if (err) throw err;
});

// Exposed stuff
//app.lBase	- larvitbase instance
//app.options	- the options sent in when instanciated

//app.stop() // close httpServer
```

Then just start the file from shell:

```bash
node index.js
```

This will provide the following:

### Default controller on / (and /default)

Go to http://localhost:8001/ and you'll see the default template being rendered with the default controller.

### Run controllers

doit

todo: Set appropriate HTML headers


Skriv on app.noTargetFound(req, res, cb) {}

Skriv on app.internalError(req, res, cb) {}

Skriv om controllers och templates och vad som händer om en controller inte finns, men en template finns

Skriv om req.finished = true, att den gör så de inbyggda middlewaresen bara passerar utan att göra nåt
