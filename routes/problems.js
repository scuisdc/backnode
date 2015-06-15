
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

var problem_keys_whitelist = [
	'description', 'input', 'output', 'language_limit',
	'memory_limit', 'time_limit', 'title'	
];

var file_keys = [ 'description', 'input', 'output' ];
var file_keys_detail = [ 'description', 'input', 'output', 'in_file', 'out_file' ];
var problem_keys_whitelist_common = [
	'ID', 'description', 'input', 'output', 'language_limit',
	'memory_limit', 'time_limit', 'title'
];
var problem_keys_whitelist_detail = [
	'ID', 'description', 'input', 'output', 'language_limit',
	'memory_limit', 'time_limit', 'title', 'in_file', 'out_file'
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
	include = include || file_keys_detail;
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

var require_privilege = function (privilege) {
	return function (req, res, next) {
		if (req.user) {
			if (!authed(req.user).has_privilege(privilege)) {
				return res.status(401).json({ succeeded: false }); }
			next();
		} else { return res.status(401).json({ succeeded: false }); }
	};
};

var fetch_problem_data = function (id, whitelist, file_keys, callback) {
	db.connect('train').query('select * from oj_problem where ID = ?', [ id ],
		function (err, rows, fields) {
			if (err) { return callback(err); }
			if (!rows || rows.length < 1) { return callback(new Error('Not found')); }
			
			rows = _(rows[0]).pick(whitelist);
			if (!config.production) {
				return callback(null, rows);
			} else {
				var files = _.chain(rows).values_for_keys(file_keys).map(function (src) {
					return path.join(config.train_rootdir, src); }).value();
				async.map(files, fs.readFile, function (err, data) {
					if (err) { return callback(err); }
					
					_(rows).extend(_(file_keys).object(_(data).invoke('toString')));
					return callback(null, rows);
				});
			}
		});
};

router.get('/', function (req, res, next) {
	db.connect('train').query('select ID, title, time_limit, memory_limit, language_limit from oj_problem order by ID', 
		function (err, rows, fields) {
			check_n_throw(err);
			res.json(rows);
		});
});

// codereview.stackexchange.com/questions/59767/read-multiple-files-async
router.get('/:id', function (req, res, next) {
	fetch_problem_data(req.params.id, problem_keys_whitelist_common, file_keys,
		function (err, row) {
			if (err) {
				if (err.message == 'Not found') { return res.status(404).send('Not found' ); }
				else { return res.status(500).json(err); }
			}
			res.status(200).json(row);
		});
});

router.get('/:id/detail', require_privilege('oj'), function (req, res, next) {
	fetch_problem_data(req.params.id, problem_keys_whitelist_detail, file_keys_detail,
		function (err, row) {
			if (err) {
				if (err.message == 'Not found') { return res.status(404).send('Not found' ); }
				else { return res.status(500).json(err); }
			}
			res.status(200).json(row);
		});
});

var fields_new_problem = {
	text: [ 'title', 'language_limit', 'time_limit', 'memory_limit' ],
	file: [ 'description', 'in_file', 'out_file', 'input', 'output' ]	
};

// post to /problem, create a problem
router.post('/', require_privilege('oj'), function (req, res, next) {
	var connection = db.connect('train');
	async.waterfall([
		function (callback) {	// fire!
			connection.beginTransaction(function (err) {
				callback(err); }); },
		function (callback) {	// ahh? just get ready and hold an ID
			connection.query('insert into oj_problem (in_file, out_file) values (?, ?);', [ '', '' ],
				function (err, result) { callback(err, result.insertId); }); },
		function (id, callback) {	// create a dir
			var problem_path = path.join(config.train_rootdir, './TPD/problem/' + id);
			fs.mkdir(problem_path, function (err) {
				// if it exists, then doesnot matter, just kick off it :)
				if (err && err.code == 'EEXIST') { err = null; }
				callback(err, id, problem_path, './TPD/problem/' + id); });
		},
		function (id, problem_path, org_path, callback) {
			async.map(fields_new_problem.file, function (field, callback) {
				var ret = [ field, path.join(problem_path, field), path.join(org_path, field) ];
				fs.writeFile(ret[1], req.body[field] || '', function (err) { callback(err, ret); });
				return ret;
			}, function (err, results) {
				if (err) { callback(err, id); }
				var db_data = _.chain(results).map(function (s) { return [ s[0], s[2] ]; }).object().value();
				console.log(db_data);
				connection.query('update oj_problem set ? where ID = ?', [ db_data, id ],
					function (err, result) { callback(err, id); });
			});
		},
		function (id, callback) {
			console.log('3', _(req.body).pick(fields_new_problem.text));
			connection.query('update oj_problem set ? where ID = ?',
				[ _(req.body).pick(fields_new_problem.text), id ],
				function (err, result) { callback(err); });
		},
		function (callback) { // commit! pull request!
			connection.commit(function (err) { callback(err); }); }
	], function (err) {
		if (err) {
			return connection.rollback(function () {
				res.status(500).send(err); });
		}
		res.status(200).json({ succeeded: true });
	});
});

router.post('/:id', require_privilege('oj'), function (req, res, next) {
	var connection = db.connect('train');
	// TBH we should use less queries
	// but lets stay on it, currently
	connection.beginTransaction(function (err) {
		check_n_throw(err);
		var splited = split_update_request(req.body);
		
		// 150615 secondwtq - it's just A PICE OF SHIIIT, but just work, however
		//	evt. someone would gonna throw it away and replace with something better
		//  don't care 
		var func_update = function (arr) {
			if (arr.length) {
				var to_be_updated = arr.pop();
				var id = to_be_updated.ID;
				to_be_updated = _.chain(to_be_updated).omit('ID').pairs().first().value();
				connection.query('update oj_problem set ?? = ? where ID = ?',
					[ to_be_updated[0], to_be_updated[1], id ], function (err, result) {
						if (err) { connection.rollback(function () { throw err; }); }
						func_update(arr);
					});
			} else {
				connection.commit(function (err) {
					if (err) { connection.rollback(function () { throw err; }); }
					else {
						var file_reqs = merge_update_request(req.body);
						if (file_reqs.length && config.production) {
							async.map(file_reqs, function (file_req, callback) {
								async.waterfall([
									function (callback) {
										connection.query('select * from oj_problem where ID = ?', [ file_req.ID ], 
											function (err, result) { callback(err, result); }); },
									function (result, callback) {
										result = _(result).first();
										file_req = _.chain(file_req).omit('ID').pairs().value();
										async.map(file_req, function (req, callback) {
											var fullpath = path.join(config.train_rootdir, result[req[0]]);
											fs.writeFile(fullpath, req[1], function (err) { return callback(err, undefined); });
										}, function (err, data) { return callback(err, undefined); });
									}
								], function (err, data) { return callback(err, undefined); });
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
