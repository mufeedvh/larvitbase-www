'use strict';

const	topLogPrefix = 'larvitbase-www: ./index.js: ',
	ReqParser	= require('larvitreqparser'),
	Router	= require('larvitrouter'),
	LBase	= require('larvitbase'),
	async	= require('async'),
	send	= require('send'),
	Lfs	= require('larvitfs'),
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
	if ( ! that.options.routerOptions.controllersPath)	{ that.options.routerOptions.controllersPath	= 'controllers';	}
	if ( ! that.options.routerOptions.basePath)	{ that.options.routerOptions.basePath	= process.cwd();	}
	if ( ! Array.isArray(that.options.routerOptions.routes))	{ that.options.routerOptions.routes	= [];	}

	if ( ! that.options.lBaseOptions) {
		that.options.lBaseOptions	= {};
	}

	if ( ! Array.isArray(options.lBaseOptions.middleware)) {
		options.lBaseOptions.middleware	= [];
	}

	that.compiledTemplates	= {};
	that.middleware	= options.lBaseOptions.middleware;

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

App.prototype.internalError = function internalError(req, res, cb) {
	req.finished	= true;
	res.statusCode	= 500;
	res.end('500 Internal Server Error');
	cb();
};

App.prototype.noTargetFound = function noTargetFound(rqe, res, cb) {
	req.finished	= true;
	res.statusCode	= 404;
	res.end('404 Not Found');
	cb();
};

App.prototype.start = function start(cb) {
	const	that	= this;

	that.lBase	= new LBase(that.options.lBaseOptions, cb);

	that.lBase.on('error', function (err, req, res) {
		that.internalError(req, res, cb);
	});
};

App.prototype.stop = function (cb) {
	const	that	= this;
	that.lBase.httpServer.close(cb);
};

exports = module.exports = App;
