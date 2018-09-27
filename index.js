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

// ejs.includeFile_org	= ejs.includeFile;

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
	
	function compile(dir, fileName, includeList, cb) {
		if(dir && fileName) {
			let	filePathAbsolute;
			
			if (fileName.substring(0, 1) === '/') {
				filePathAbsolute = path.join(dir, that.router.options.paths.template.path, fileName);
			}
			
			// Try with the extensions passed to the router
			if (! filePathAbsolute && that.router && that.router.options && Array.isArray(that.router.options.paths.template.exts)) {
				for (const ext of that.router.options.paths.template.exts) {
					filePathAbsolute	= lfsInstances[dir].getPathSync(that.router.options.paths.template.path + '/' + fileName + '.' + ext);
					if (filePathAbsolute) break;
				}
			}
			if(! filePathAbsolute) {
				return cb(new Error('File not found. path provided: ' + dir + ' fileName provided: ' + fileName), null);
			}
			
			if(fs.access(filePathAbsolute, fs.constants.F_OK, function (err) {
				if(err) return cb(err, null);
				
				fs.readFile(filePathAbsolute, 'utf-8', function (err, fileText) {
					if (err) return cb(err, null);
					
					let	includes = fileText.match(/<%-\s*include\s*(.*?)\s*%>/g);

					if(! includes) return cb(null, fileText);
					
					if(! includeList) includeList = [];

					if(includeList.indexOf(filePathAbsolute) !== - 1) {
						// There seems to be a circular include, return error.
						return cb(new Error('File ' + includeList[0] + ' causes a circular include call. ' + includeList[includeList.length - 1] + ' calls ' + filePathAbsolute + ' again.'), null);
					}

					includeList.push(filePathAbsolute);

					const	subTasks = [];

					includes.forEach(function (regx) {
						subTasks.push(function (cb) {
							let	includeFile = /<%-\s*include\('(.*?)'/g.exec(regx), includeArgs;
							
							if(! includeFile) return cb();

							includeArgs = /{(.*?)}/.exec(regx);
							
							compile(dir, includeFile[1].substring(0, (includeFile[1].indexOf('.') === - 1 ? includeFile[1].length : includeFile[1].indexOf('.'))), includeList, function (err, html) {
								if(err) return cb(err);

								if(includeArgs) {
									let	replaceArgs = html.match(/<%=([^)]+?)\%>/gm), args = JSON.parse(includeArgs[0].replace(/'/g, '"'));
									if(args) {
										replaceArgs.forEach(function (repArg) {
											let	argKey = /<%=\s*(.*?)s*%>/.exec(repArg)[1], arg = args[argKey.trim()];

											if(arg) html = html.replace(repArg, arg);
										});
									}
								}

								fileText = fileText.replace(regx.toString(), html);
								return cb();
							});
						});
					});

					async.parallel(subTasks, function (err) {
						if (err) return cb(err);
						cb(null, fileText);
					});
				});
			}));
		}
	};

	if (! that.compiledTemplates[req.routed.templateFullPath]) {
		log.debug(logPrefix + 'Compiling template: ' + req.routed.templateFullPath);
	
		let	tmplDir = path.parse(req.routed.templateFullPath).dir, fileName = req.routed.templateFullPath.substring(tmplDir.length);

		tmplDir = tmplDir.substring(0, tmplDir.length - that.router.options.paths.template.path.length);

		if (! lfsInstances[tmplDir]) {
			lfsInstances[tmplDir]	= new Lfs({'basePath': tmplDir});
		}

		tasks.push(function (cb) {
			compile(tmplDir, fileName, null, function (err, result) {
				let	html;

				if(err) {
					log.error(logPrefix + 'Could not read template file. err: ' + err.message);
					return cb(err);
				}
				html	= result.toString();

				try {
					that.compiledTemplates[req.routed.templateFullPath]	= ejs.compile(html);
				} catch (err) {
					log.error(logPrefix + 'Could not compile "' + req.routed.templateFullPath + '", err: ' + err.message);
					return cb(err);
				}

				cb();
			});
		});
	}

	async.series(tasks, function (err) {
		if (err) return cb(err);
		try {
			res.renderedData	= that.compiledTemplates[req.routed.templateFullPath](res.data);
		} catch (err) {
			log.error(logPrefix + 'Could not render "' + req.routed.templateFullPath + '", err: ' + err.message);
			return cb(err);
		}
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
			if (err) return cb(err);

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
		const	sendStream	= send(req, req.routed.staticFullPath, {'index':	false});

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

	that.base	= new LBase(that.options.baseOptions);

	that.base.on('error', function (err, req, res) {
		that.internalError(req, res);
	});

	that.base.start(cb);
};

App.prototype.stop = function (cb) {
	const	that	= this;
	that.base.httpServer.close(cb);
};

exports = module.exports = App;
