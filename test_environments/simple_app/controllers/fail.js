'use strict';

exports = module.exports = function (req, res, cb) {
	res.data = {foo: 'bar', blupp: res};
	cb();
};
