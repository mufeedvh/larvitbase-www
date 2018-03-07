'use strict';

const	request	= require('request'),
	async	= require('async'),
	test	= require('tape'),
	App	= require(__dirname + '/../index.js');

test('Start with no options at all', function (t) {
	const	tasks	= [],
		app	= new App();

	tasks.push(function (cb) {
		app.start(cb);
	});

	// All requests should be 404 by default
	tasks.push(function (cb) {
		request('http://localhost:' + app.base.httpServer.address().port + '/', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	404);
			t.equal(body,	'404 Not Found');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		app.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});

test('Get a response from a controller', function (t) {
	const	tasks	= [];

	let	app;

	// Initialize app
	tasks.push(function (cb) {
		app = new App({
			'routerOptions':	{'basePath': __dirname + '/../test_environments/get_a_response_from_a_controller'}
		});
		cb();
	});

	tasks.push(function (cb) {
		app.start(cb);
	});

	// Try 200 request
	tasks.push(function (cb) {
		request('http://localhost:' + app.base.httpServer.address().port + '/', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	200);
			t.equal(body,	'{"foo":"bar"}');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		app.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});

test('Malfunctioning middleware', function (t) {
	const	tasks	= [];

	let	app;

	// Initialize app
	tasks.push(function (cb) {
		const	options	= {};

		options.baseOptions = {
			'middleware': [
				function (req, res, cb) {
					cb(new Error('boink'));
				}
			]
		};

		app	= new App(options);

		cb();
	});

	tasks.push(function (cb) {
		app.start(cb);
	});

	// Try 500 request
	tasks.push(function (cb) {
		request('http://localhost:' + app.base.httpServer.address().port + '/', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	500);
			t.equal(body,	'500 Internal Server Error');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		app.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});

test('404 with custom template', function (t) {
	const	tasks	= [];

	let	app;

	// Initialize app
	tasks.push(function (cb) {
		app = new App({
			'routerOptions':	{'basePath': __dirname + '/../test_environments/404_with_custom_template'}
		});
		cb();
	});

	tasks.push(function (cb) {
		app.start(cb);
	});

	// Try 200 request
	tasks.push(function (cb) {
		request('http://localhost:' + app.base.httpServer.address().port + '/nowhere', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	404);
			t.equal(body.trim(),	'There is no page here');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		app.stop(cb);
	});

	async.series(tasks, function (err) {
		if (err) throw err;
		t.end();
	});
});
