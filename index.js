'use strict';

const	lfsInstances	= {},
	topLogPrefix	= 'larvitbase-www: ./index.js: ',
	ReqParser	= require('larvitreqparser'),
	Router	= require('larvitrouter'),
	LBase	= require('larvitbase'),
	async	= require('async'),
	send	= require('send'),
	path	= require('path'),
	Lfs	= require('larvitfs'),
	ejs	= require('ejs'),
	log	= require('winston'),
	fs	= require('fs');

ejs.includeFile_org	= ejs.includeFile;

function App(options) {
	const	that	= this;

	if ( ! options) {
		options	= {};
	}

	that.options	= options;

	if ( ! that.options.routerOptions)	{ that.options.routerOptions	= {};	}
	if ( ! that.options.baseOptions)	{ that.options.baseOptions	= {};	}

	that.compiledTemplates	= {};

	// Instantiate the router
	that.router	= new Router(that.options.routerOptions);

	// Instantiate the request parser
	that.reqParser	= new ReqParser(that.options.reqParserOptions);

	// Only set middleware array if none is provided from the initiator
	if ( ! Array.isArray(options.baseOptions.middleware)) {
		options.baseOptions.middleware = [
			function mwParse(req, res, cb)	{ that.mwParse(req, res, cb);	},
			function mwRoute(req, res, cb)	{ that.mwRoute(req, res, cb);	},
			function mwSendStatic(req, res, cb)	{ that.mwSendStatic(req, res, cb);	},
			function mwRunController(req, res, cb)	{ that.mwRunController(req, res, cb);	},
			function mwRender(req, res, cb)	{ that.mwRender(req, res, cb);	},
			function mwSendToClient(req, res, cb)	{ that.mwSendToClient(req, res, cb);	},
			function mwCleanup(req, res, cb)	{ that.mwCleanup(req, res, cb);	}
		];
	}

	// Expose middlewares more convenient
	that.middleware	= options.baseOptions.middleware;
};

// Internal server error. 500
App.prototype.internalError = function internalError(req, res) {
	res.statusCode	= 500;
	res.end('500 Internal Server Error');
};

// No route target found. 404
App.prototype.noTargetFound = function noTargetFound(req, res, cb) {
	const	that	= this;

	res.statusCode	= 404;

	that.router.resolve('/404', function (err, result) {
		if ( ! result.templateFullPath) {
			res.end('404 Not Found');
			req.finished	= true;
		} else {
			req.routed.controllerPath	= result.controllerPath;
			req.routed.controllerFullPath	= result.controllerFullPath;
			req.routed.templatePath	= result.templatePath;
			req.routed.templateFullPath	= result.templateFullPath;
		}

		cb();
	});
};

// Cleanup middleware, removing tmp file storage and more
App.prototype.mwCleanup = function mwCleanup(req, res, cb) {
	const	that	= this;

	delete req.finished;

	that.reqParser.clean(req, res, cb);
};

// Parsing middleware
App.prototype.mwParse = function mwParse(req, res, cb) {
	const	that	= this;

	req.logPrefix	= topLogPrefix + 'req.uuid: ' + req.uuid + ' url: ' + req.url + ' - ';

	if (req.finished) return cb();

	that.reqParser.parse(req, res, cb);
};

// Template rendering middleware
App.prototype.mwRender = function mwRender(req, res, cb) {
	const	logPrefix	= req.logPrefix + 'mwRender() - ',
		tasks	= [],
		that	= this;

	if (req.finished || req.render === false) return cb();

	if ( ! req.routed.templateFullPath) {
		log.verbose(logPrefix + 'No template found. req.routed.templateFullPath is not set.');
		return cb();
	}

	if ( ! that.compiledTemplates[req.routed.templateFullPath]) {
		log.debug(logPrefix + 'Compiling template: ' + req.routed.templateFullPath);

		// Custom ejs includeFile that uses larvitfs to search through node_modules for templates
		ejs.includeFile = function (filePath, options) {
			let	tmplDir	= path.parse(req.routed.templateFullPath).dir,
				filePathAbsolute;

			if (filePath.substring(1) === '/') {
				return ejs.includeFile_org(filePath, options);
			}

			// Remove the template-part of the tmplDir
			tmplDir	= tmplDir.substring(0, tmplDir.length - that.router.options.templatesPath.length);

			if ( ! lfsInstances[tmplDir]) {
				lfsInstances[tmplDir]	= new Lfs({'basePath': tmplDir});
			}

			filePathAbsolute	= lfsInstances[tmplDir].getPathSync(that.router.options.templatesPath + '/' + filePath);

			// Try with the extensions passed to the router
			if ( ! filePathAbsolute && that.router && that.router.options && Array.isArray(that.router.options.templateExts)) {
				for (const ext of that.router.options.templateExts) {
					filePathAbsolute	= lfsInstances[tmplDir].getPathSync(that.router.options.templatesPath + '/' + filePath + '.' + ext);
					if (filePathAbsolute) break;
				}
			}

			if ( ! filePathAbsolute) {
				throw new Error('Can not find template matching "' + filePath + '"');
			}

			return ejs.includeFile_org(filePathAbsolute, options);
		};

		tasks.push(function (cb) {
			fs.readFile(req.routed.templateFullPath, function (err, str) {
				let	html;

				if (err) {
					log.error(logPrefix + 'Could not read template file. err: ' + err.message);
					return cb(err);
				}

				html	= str.toString();
				that.compiledTemplates[req.routed.templateFullPath]	= ejs.compile(html);
				cb();
			});
		});
	}

	async.series(tasks, function (err) {
		if (err) return cb(err);
		res.renderedData	= that.compiledTemplates[req.routed.templateFullPath](res.data);
		cb();
	});
};

// Routing middleware
App.prototype.mwRoute = function mwRoute(req, res, cb) {
	const	logPrefix	= req.logPrefix + 'mwRoute() - ',
		tasks	= [],
		that	= this;

	let	routeUrl;

	if (req.finished) return cb();

	if ( ! req.urlParsed) {
		const	err	= new Error('req.urlParsed is not set');
		log.error(logPrefix + err.message);
		log.verbose(err.stack);
		return cb(err);
	}

	routeUrl	= req.urlParsed.pathname;
	req.routed	= {};

	// Explicitly route / to default when we resolv files
	if (routeUrl.split('?')[0] === '/') {
		routeUrl	= '/default';
	} else if (routeUrl.split('?')[0] === '/.json') {
		routeUrl	= '/default.json';
	}

	// Handle URLs ending in .json
	if (req.urlParsed.pathname.substring(req.urlParsed.pathname.length - 4) === 'json') {
		log.debug(logPrefix + 'url ends in json, use some custom route options');

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

	// Resolve stuff with the router
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
};

// Controller running middleware
App.prototype.mwRunController = function mwRunController(req, res, cb) {
	const	logPrefix	= req.logPrefix + 'mwRunController() - ',
		that	= this;

	if (req.finished) return cb();

	if (req.routed.templateFullPath && ! req.routed.controllerFullPath) {
		log.debug(logPrefix + 'Only template found');
		return cb();
	} else if ( ! req.routed.controllerFullPath && ! req.routed.templateFullPath) {
		log.debug(logPrefix + 'Either controller nor template found for given url, running that.noTargetFound()');
		that.noTargetFound(req, res, cb);
	} else { // Must be a controller here
		log.debug(logPrefix + 'Controller found, running');
		require(req.routed.controllerFullPath)(req, res, cb);
	}
};

// Send static files middleware
App.prototype.mwSendStatic = function mwSendStatic(req, res, cb) {
	const	logPrefix	= req.logPrefix + 'mwSendStatic() - ';

	if (req.finished) return cb();

	if (req.routed.staticFullPath) {
		const	sendStream	= send(req, req.routed.staticFullPath, {'index':	false, 'root': '/'});

		req.finished	= true;

		log.debug(logPrefix + 'Static file found, streaming');

		sendStream.pipe(res);

		sendStream.on('error', function (err) {
			log.warn(logPrefix + 'error sending static file to client. err: ' + err.message);
			return cb(err);
		});

		sendStream.on('end', cb);
	} else {
		return cb();
	}
};

// Middleware for sending data to client
App.prototype.mwSendToClient = function mwSendToClient(req, res, cb) {
	const	logPrefix	= req.logPrefix + 'mwSendToClient() - ';

	let	sendData	= res.data;

	if (req.finished) return cb();

	// Rendered data means HTML, send as string to the client
	if (res.renderedData) {
		res.setHeader('Content-Type', 'text/html; charset=UTF-8');
		res.end(res.renderedData);
		req.finished	= true;
		return cb();
	}

	// If no rendered data exists, send res.data as stringified JSON to the client
	res.setHeader('Content-Type', 'application/json; charset=UTF-8');

	try {
		if (typeof sendData !== 'string' && ! Buffer.isBuffer(sendData)) {
			sendData	= JSON.stringify(sendData);
		}
	} catch (err) {
		log.warn(logPrefix + 'Could not stringify sendData. err: ' + err.message);
		return cb(err);
	}

	res.end(sendData);
	req.finished	= true;
	cb();
};

App.prototype.start = function start(cb) {
	const	that	= this;

	that.base	= new LBase(that.options.baseOptions, cb);

	that.base.on('error', function (err, req, res) {
		that.internalError(req, res);
	});
};

App.prototype.stop = function (cb) {
	const	that	= this;
	that.base.httpServer.close(cb);
};

exports = module.exports = App;
