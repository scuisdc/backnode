
var path = require('path');
var fs = require('fs');
var _ = require('underscore');
var async = require('async');

var express = require('express');
var router = express.Router();

var authed = require('../modules/authed');
var config = require('../bkconfig');
var db = require('../modules/bkdb');

var check_n_throw = function (err) { if (err) { throw err; } };

var file_keys = [ 'description', 'input', 'output' ];
var problem_keys_whitelist = [
	'description', 'input', 'output', 'language_limit',
	'memory_limit', 'time_limit', 'title'	
];

var split_update_request = function (arr, ignore) {
	ignore = ignore || file_keys;
	var ret = [ ];
	
	arr.forEach(function (element, index, array) {
		for (var k in _.chain(element).omit(ignore).pick(problem_keys_whitelist).value()) {
			if (k != 'ID') {
				var pushed = { 'ID': element['ID'] };
				pushed[k] = element[k];
				ret.push(pushed);
			}
		}
	});
	
	return ret;
};

var merge_update_request = function (arr, include) {
	include = include || file_keys;
	var ret_obj = { };
	
	arr.forEach(function (element, index, array) {
		element = _(element).pick(include, 'ID');
		var id = element.ID;
		if (_(element).keys().length > 1) {
			if (ret_obj[id] !== undefined) {
				_(ret_obj[id]).extend(element);
			} else { ret_obj[id] = element; }
		}
	});
	
	return _(ret_obj).values();
};

_.mixin({ values_for_keys: function (obj, arr) {
	var ret = [ ];
	for (var i = 0; i < arr.length; i++) {
		ret.push(obj[arr[i]]); }
	return ret; 
}});

router.get('/', function (req, res, next) {
	db.connect('train').query('select ID, title, time_limit, memory_limit, language_limit from oj_problem order by ID', 
		function (err, rows, fields) {
			check_n_throw(err);
			res.json(rows);
		});
});

// codereview.stackexchange.com/questions/59767/read-multiple-files-async
router.get('/:id', function (req, res, next) {
	db.connect('train').query('select * from oj_problem where ID = ?', 
		[ req.params.id ], function (err, rows, fields) {
			check_n_throw(err);
			if (rows.length < 1) {
				res.status(404).send('Not found'); }
			
			if (config.production) {
				var files = _.chain(rows[0]).values_for_keys(file_keys).map(function (src) { return path.join(config.train_rootdir, src); }).value();
				async.map(files, fs.readFile, function (err, data) {
					if (err) {
						res.status(500).send(err.code);
						return;
					}
					
					_(rows[0]).extend(_(file_keys).object(_(data).invoke('toString')));
					return res.status(200).json(rows[0]);
				});
			} else { return res.status(200).json(rows[0]); }
		});
});

var require_privilege = function (privilege) {
	return function (req, res, next) {
		if (req.user) {
			if (!authed(req.user).has_privilege(privilege)) {
				return res.status(401).json({ succeeded: false }); }
			next();
		} else { return res.status(401).json({ succeeded: false }); }
	};
};

router.get('/:id/detail', require_privilege('oj'), function (req, res, next) {
	
});

router.post('/:id', require_privilege('oj'), function (req, res, next) {
	var connection = db.connect('train');
	// TBH we should use less queries
	// but lets stay on it, currently
	connection.beginTransaction(function (err) {
		check_n_throw(err);
		var splited = split_update_request(req.body);
		
		var func_update = function (arr) {
			if (arr.length) {
				var to_be_updated = arr.pop();
				var id = to_be_updated.ID;
				to_be_updated = _.chain(to_be_updated).omit('ID').pairs().first().value();
				connection.query('update oj_problem set ?? = ? where ID = ?',
					[ to_be_updated[0], to_be_updated[1], id ], function (err, result) {
						if (err) {
							connection.rollback(function () { throw err; }); }
						func_update(arr);
					});
			} else {
				connection.commit(function (err) {
					if (err) { connection.rollback(function () { throw err; }); }
					else {
						var file_reqs = merge_update_request(req.body);
						if (file_reqs.length || !config.production) {
							async.map(file_reqs, function (file_req, callback) {
								connection.query('select * from oj_problem where ID = ?', [ file_req.ID ], 
									function (err, result) {
										if (err) { return callback(err); }
										result = _(result).first();
										file_req = _.chain(file_req).omit('ID').pairs().value();
										async.map(file_req, function (req, callback) {
											var fullpath = path.join(config.train_rootdir, result[req[0]]);
											fs.writeFile(fullpath, req[1],
												function (err) {
													if (err) { return callback(err); }
													callback(null, undefined);
												});
										}, function (err, data) {
											if (err) { return callback(err); }
											callback(null, undefined); });
									});
							}, function (err, data) {
								if (err) { return res.status(500).send(err.code); }
								res.status(200).send();
							});
						} else { res.status(200).send(); }
					}
				});
			}
		};
		
		func_update(splited);
	});
});

module.exports = router;
