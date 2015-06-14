/// <reference path="typings/node/node.d.ts"/>

var _ = require('underscore');

var express = require('express');
var app = express();

var logger = require('morgan');
var cookie_parser = require('cookie-parser');
var session = require('express-session');
var body_parser = require('body-parser');
var method_override = require('method-override');

app.use(logger('short'));
app.use(cookie_parser());
app.use(body_parser.json());
app.use(method_override());

var config = require('./bkconfig');
var db = require('./modules/bkdb');

var authed = require('./modules/authed');

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
	db.connect('user').query('select ID, username, displayname, email, isdcmail, register_time, privilege from user where username = ? and passwd = ?', 
		[ username, MD5(SHA1(passwd)) ], function (err, rows, fields) {
			if (rows.length) {
				var user = rows[0];
				user.privilege_list = authed(user).list_privileges();
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

app.use(function (req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	return next();
});

var route_auth = require('./routes/auth');
app.use('/user', route_auth);

var route_problems = require('./routes/problems');
app.use('/problems', route_problems);

var server = app.listen(process.env.PORT || 8888, process.env.HOST || 'localhost', function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening @ http://%s:%s', host, port);
});
