
var express = require('express');
var router = express.Router();

var passport = require('passport');

router.post('/auth', function (req, res, next) {
	passport.authenticate('local', function (err, user, info) {
		if (err) { return next(err); }
		if (!user) {
			return res.json({
				'succeeded': false }); }
		req.login(user, function (err) {
			if (err) { return next(err); }
			return res.json({
				'succeeded': true });
		});
	}) (req, res, next);
});

module.exports = router;
