'use strict';

const	topLogPrefix = 'larvitbase-www: ./index.js: ',
	ReqParser	= require('larvitreqparser'),
	Router	= require('larvitrouter'),
	LBase	= require('larvitbase'),
	async	= require('async'),
	send	= require('send'),
	ejs	= require('ejs'),
	log	= require('winston'),
	fs	= require('fs');

function App(options) {
	const	that	= this,
		logPrefix = topLogPrefix + 'App() - ';

	if ( ! options) {
		options	= {};
	}

	that.options	= options;

	if ( ! that.options.routerOptions)	{ that.options.routerOptions	= {};	}
	if ( ! that.options.baseOptions)	{ that.options.baseOptions	= {};	}

	if ( ! Array.isArray(options.baseOptions.middleware)) {
		options.baseOptions.middleware	= [];
	}

	that.compiledTemplates	= {};
	that.middleware	= options.baseOptions.middleware;

	// Instantiate the router
	that.router	= new Router(that.options.routerOptions);

	// Instantiate the request parser
	that.reqParser	= new ReqParser(that.options.reqParserOptions);

	// Parse request
	that.middleware.push(function parse(req, res, cb) {
		req.logPrefix = logPrefix + 'req.uuid: ' + req.uuid + ' url: ' + req.url + ' - ';

		if (req.finished) return cb();

		that.reqParser.parse(req, res, cb);
	});

	// Route request
	that.middleware.push(function route(req, res, cb) {
		const	tasks	= [];

		let	routeUrl	= req.urlParsed.pathname;

		if (req.finished) return cb();

		req.routed	= {};

		// Handle URLs ending in .json
		if (req.urlParsed.pathname.substring(req.urlParsed.pathname.length - 4) === 'json') {
			req.render	= false;
			routeUrl	= req.urlParsed.pathname.substring(0, req.urlParsed.pathname.length - 5);

			// Since the URL ends in .json, also check for static files
			tasks.push(function (cb) {
				that.router.resolve(req.urlParsed.pathname, function (err, result) {
					if (err) return cb(err);

					if (result.staticPath) {
						req.routed.staticPath	= result.staticPath;
						req.routed.staticFullPath	= result.staticFullPath;
					}

					cb();
				});
			});
		} else {
			req.render	= true;
		}

		tasks.push(function (cb) {
			that.router.resolve(routeUrl, function (err, result) {
				req.routed.controllerPath	= result.controllerPath;
				req.routed.controllerFullPath	= result.controllerFullPath;
				req.routed.templatePath	= result.templatePath;
				req.routed.templateFullPath	= result.templateFullPath;

				// Do not overwrite the .json file path from above with undefined here
				if (result.staticPath) {
					req.routed.staticPath	= result.staticPath;
					req.routed.staticFullPath	= result.staticFullPath;
				}

				cb(err);
			});
		});

		async.parallel(tasks, cb);
	});

	// Feed static file
	that.middleware.push(function sendStatic(req, res, cb) {
		if (req.finished) return cb();

		if (req.routed.staticFullPath) {
			const	sendStream	= send(req, req.routed.staticFullPath, {'index':	false, 'root': '/'});

			req.finished	= true;

			log.debug(req.logPrefix + 'Static file found, streaming');

			sendStream.pipe(res);

			sendStream.on('error', function (err) {
				log.warn(req.logPrefix + 'error sending static file to client. err: ' + err.message);
				return cb(err);
			});

			sendStream.on('end', cb);
		} else {
			return cb();
		}
	});

	// Run controller
	that.middleware.push(function controller(req, res, cb) {
		if (req.finished) return cb();

		if (req.routed.templateFullPath && ! req.routed.controllerFullPath) {
			log.debug(req.logPrefix + 'Only template found');
			return cb();
		} else if ( ! req.routed.controllerFullPath && ! req.routed.templateFullPath) {
			that.noTargetFound(req, res, cb);
		} else { // Must be a controller here
			require(req.routed.controllerFullPath)(req, res, cb);
		}
	});

	// Render template
	that.middleware.push(function render(req, res, cb) {
		const	tasks	= [];

		if (req.finished || req.render === false) return cb();

		if ( ! req.routed.templateFullPath) {
			log.verbose(logPrefix + 'No template found. req.routed.templateFullPath is not set.');
			return cb();
		}

		if ( ! that.compiledTemplates[req.routed.templateFullPath]) {
			log.debug(logPrefix + 'Compiling ' + req.routed.templateFullPath);
			tasks.push(function (cb) {
				fs.readFile(req.routed.templateFullPath, function (err, str) {
					let html;

					if (err) {
						log.error(logPrefix + 'Could not read template file');
						return cb(err);
					}

					html = str.toString();
					that.compiledTemplates[req.routed.templateFullPath]	= ejs.compile(html);
					cb();
				});
			});
		}

		async.series(tasks, function (err) {
			if (err) return cb(err);
			res.renderedData	= that.compiledTemplates[req.routed.templateFullPath](res.data);
			res.setHeader('Content-Type', 'text/html; charset=UTF-8');
			res.end(res.renderedData);
			req.finished	= true;
			cb();
		});
	});

	// Output to client
	that.middleware.push(function (req, res, cb) {
		let	sendData	= res.data;

		if (req.finished) return cb();

		res.setHeader('Content-Type', 'application/json; charset=UTF-8');

		try {
			if (typeof sendData !== 'string' && ! Buffer.isBuffer(sendData)) {
				sendData	= JSON.stringify(sendData);
			}
		} catch (err) {
			return cb(err);
		}

		res.end(sendData);
		cb();
	});

	// Clean up if file storage is used by parser
	that.middleware.push(function cleanup(req, res, cb) {
		delete req.finished;

		that.reqParser.clean(req, res, cb);
	});
};

// Internal server error. 500
App.prototype.internalError = function internalError(req, res, cb) {
	res.statusCode	= 500;

	that.router.resolve('/500', function (err, result) {
		if ( ! result.templateFullPath) {
			res.end('500 Internal Server Error');
			req.finished	= true;
		} else {
			req.routed.templateFullPath	= result.templateFullPath;
		}

		cb();
	});
};

// No route target found. 404
App.prototype.noTargetFound = function noTargetFound(rqe, res, cb) {
	res.statusCode	= 404;

	that.router.resolve('/', function (err, result) {
		if ( ! result.templateFullPath) {
			res.end('404 Not Found');
			req.finished	= true;
		} else {
			req.routed.templateFullPath	= result.templateFullPath;
		}

		cb();
	});
};

App.prototype.start = function start(cb) {
	const	that	= this;

	that.base	= new LBase(that.options.baseOptions, cb);

	that.base.on('error', function (err, req, res) {
		that.internalError(req, res, cb);
	});
};

App.prototype.stop = function (cb) {
	const	that	= this;
	that.base.httpServer.close(cb);
};

exports = module.exports = App;
