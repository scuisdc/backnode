/// <reference path="typings/node/node.d.ts"/>

var express = require('express');
var app = express();

var logger = require('morgan');
app.use(logger('dev'));

var check_n_throw = function (err) { if (err) { throw err; } };

var mysql = require('mysql');

var config = require('bkconfig');

var db_config = {
	host : config.db_host,
	user : config.db_username,
	password : config.db_passwd,
	database: config.dbname_train,
	port: config.db_port
};

var db = mysql.createConnection(db_config);

db.connect(function () {
	console.log('DB connected.'); });

app.use(function (req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	return next();
});

app.get('/problems', function (req, res, next) {
	var r = new Array();
	r.push({
		ID: 1,
		title: 'aaaaa',
		time_limit: 100,
		memory_limit: 100,
		language: 3
	});
	res.json(r);
	// db.query('select ID, title, time_limit, memory_limit from oj_problem order by ID', 
	// 	function (err, rows, fields) {
	// 		check_n_throw(err);
	// 		res.json(rows);
	// 	});
});

app.get('/problems/:id', function (req, res, next) {
	db.query('select * from oj_problem where ID = ' + req.params.id, function (err, rows, fields) {
		check_n_throw(err);
		if (rows.length < 1) {
			res.status(404).send('Not found'); }
		res.json(rows[0]);
	});
});

app.post('/problems', function (req, res, next) {
	// res.send('aaa');
	res.status(400).send('aaa');
});

var server = app.listen(process.env.PORT || 8888, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening @ http://%s:%s', host, port);
});
