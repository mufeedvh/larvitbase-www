'use strict';

const	request	= require('request'),
	async	= require('async'),
	test	= require('tape'),
	Api	= require(__dirname + '/../index.js'),
	fs	= require('fs');

test('Get a response from a controller', function (t) {
	const	tasks	= [];

	let	api;

	// Initialize api
	tasks.push(function (cb) {
		api	= new Api({
			'routerOptions':	{'basePath': __dirname + '/../test_environment/1'}
		});
		cb();
	});

	tasks.push(function (cb) {
		api.start(cb);
	});

	// Try 200 request
	tasks.push(function (cb) {
		request('http://localhost:' + api.lBase.httpServer.address().port + '/webb', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	200);
			t.equal(body,	'{"v": "1.3.2"}');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		api.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});

test('Get a response from a controller, ignoring url parameters', function (t) {
	const	tasks	= [];

	let	api;

	// Start server
	tasks.push(function (cb) {
		api = new Api({
			'routerOptions':	{'basePath': __dirname + '/../test_environment/1'}
		});

		cb();
	});

	tasks.push(function (cb) {
		api.start(cb);
	});

	// Try 200 request
	tasks.push(function (cb) {
		request('http://localhost:' + api.lBase.httpServer.address().port + '/webb?boll', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	200);
			t.equal(body,	'{"v": "1.3.2"}');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		api.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});

test('Get controller without version mappings', function (t) {
	const	tasks	= [];

	let	api;

	// Start server
	tasks.push(function (cb) {
		api = new Api({
			// To get better test coverage, send in specific middleware array
			'lBaseOptions': {
				'middleware':	[]
			},

			'routerOptions': {
				'basePath':	__dirname + '/../test_environment/2',

				// We do this explicitly to get better test coverage
				'controllersPath':	'controllers',
				'routes':	[]
			}
		});

		cb();
	});

	tasks.push(function (cb) {
		api.start(cb);
	});

	// Try 200 request
	tasks.push(function (cb) {
		request('http://localhost:' + api.lBase.httpServer.address().port + '/foo', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	200);
			t.equal(body,	'{"foo":"bar"}');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		api.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});

test('Specific version request', function (t) {
	const	tasks	= [];

	let	api;

	// Start server
	tasks.push(function (cb) {
		api = new Api({
			'routerOptions':	{'basePath': __dirname + '/../test_environment/1'}
		});

		cb();
	});

	tasks.push(function (cb) {
		api.start(cb);
	});

	// Try 200 request
	tasks.push(function (cb) {
		request('http://localhost:' + api.lBase.httpServer.address().port + '/0.2/wepp', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	200);
			t.equal(body,	'{"v":"0.2.0"}');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		api.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});

test('Get specific version of README.md', function (t) {
	const	tasks	= [];

	let	api;

	// Start server
	tasks.push(function (cb) {
		api = new Api({
			'routerOptions':	{'basePath': __dirname + '/../test_environment/1'}
		});

		cb();
	});

	tasks.push(function (cb) {
		api.start(cb);
	});

	// Try 200 request for README.md
	tasks.push(function (cb) {
		request('http://localhost:' + api.lBase.httpServer.address().port + '/0.2/?dal', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	200);
			t.equal(body,	'This is old 0.2.0\n');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		api.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});

test('Start without options', function (t) {
	const	tasks	= [];

	let	api;

	// Start server
	tasks.push(function (cb) {
		api = new Api();
		cb();
	});

	tasks.push(function (cb) {
		api.start(cb);
	});

	// Try 200 request for README.md
	tasks.push(function (cb) {
		request('http://localhost:' + api.lBase.httpServer.address().port + '/', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	200);
			t.equal(body,	fs.readFileSync(__dirname + '/../README.md').toString());
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		api.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});

test('Start without options or cb', function (t) {
	const	tasks	= [];

	let	api;

	// Start server
	tasks.push(function (cb) {
		api = new Api();
		cb();
	});

	tasks.push(function (cb) {
		api.start(cb);
	});

	// Try 200 request for README.md
	tasks.push(function (cb) {
		request('http://localhost:' + api.lBase.httpServer.address().port + '/', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	200);
			t.equal(body,	fs.readFileSync(__dirname + '/../README.md').toString());
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		api.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});
