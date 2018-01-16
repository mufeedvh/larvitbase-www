[![Build Status](https://travis-ci.org/larvit/larvitbase-www.svg)](https://travis-ci.org/larvit/larvitbase-www) [![Dependencies](https://david-dm.org/larvit/larvitbase-www.svg)](https://david-dm.org/larvit/larvitbase-www.svg)
[![Coverage Status](https://coveralls.io/repos/github/larvit/larvitbase-www/badge.svg)](https://coveralls.io/github/larvit/larvitbase-www)

# larvitbase-www

Website base framework based on [larvitbase](https://github.com/larvit/larvitbase)

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

**req.render = true** by default och req.render = false ska ge json

Skriv om att mata static files

Skriv on app.noTargetFound(req, res, cb) {}

Skriv on app.internalError(req, res, cb) {}

Skriv om controllers och templates och vad som händer om en controller inte finns, men en template finns

Skriv om req.finished = true, att den gör så de inbyggda middlewaresen bara passerar utan att göra nåt
