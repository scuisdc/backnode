/// <reference path="typings/node/node.d.ts"/>

var express = require('express');
var app = express();

var logger = require('morgan');
var cookie_parser = require('cookie-parser');
var session = require('express-session');
var body_parser = require('body-parser');
var method_override = require('method-override');

app.use(logger('dev'));
app.use(cookie_parser());
app.use(body_parser.json());
app.use(method_override());

var config = require('./bkconfig');
var db = require('./bkdb');

app.use(session({
	secret: config.session_secret,
	rolling: true, resave: true,
	maxAge: new Date(Date.now() + 3600000)
}));

var passport = require('passport');
var LocalStrategy = require('passport-local');

var MD5 = function (s) { return require('crypto-js/md5')(s).toString(); };
var SHA1 = function (s) { return require('crypto-js/sha1')(s).toString(); }

passport.use(new LocalStrategy (function (username, passwd, done) {
	db.connect('user').query('select * from user where username = ? and passwd = ?', 
		[ username, MD5(SHA1(passwd)) ], function (err, rows, fields) {
			if (rows.length) {
				var user = rows[0];
				return done(null, user);
			} else {
				return done(null, false, { message: 'Username and password doesnot match.' }); }
		});
}));

passport.serializeUser(function (user, done) {
	console.log('passport: serializing user ', user.username);
	done(null, user); });
passport.deserializeUser(function (user, done) {
	console.log('passport: deserialize user ', user.username);
	done(null, user); });
	
app.use(passport.initialize());
app.use(passport.session());

var check_n_throw = function (err) { if (err) { throw err; } };

app.use(function (req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	return next();
});

var route_auth = require('./routes/auth');
app.use('/user', route_auth);

app.get('/problems', function (req, res, next) {
	db.connect('train').query('select ID, title, time_limit, memory_limit, language_limit from oj_problem order by ID', 
		function (err, rows, fields) {
			check_n_throw(err);
			res.json(rows);
		});
});

app.get('/problems/:id', function (req, res, next) {
	db.connect('train').query('select * from oj_problem where ID = ?', [ req.params.id ], function (err, rows, fields) {
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
