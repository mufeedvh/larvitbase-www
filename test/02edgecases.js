'use strict';

const	request	= require('request'),
	LUtils	= require('larvitutils'),
	lUtils	= new LUtils(),
	async	= require('async'),
	test	= require('tape'),
	log	= new lUtils.Log('no logging'),
	App	= require(__dirname + '/../index.js');

test('Malfunctioning middleware', function (t) {
	const	tasks	= [];

	let	app;

	// Initialize app
	tasks.push(function (cb) {
		const	options	= {};

		options.log	= log;

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
