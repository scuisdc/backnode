
var express = require('express');
var router = express.Router();

var passport = require('passport');

router.get('/auth', function (req, res, next) {
	if (req.user) {
		res.status(200).json({ succeeded: true, user: req.user });
	} else { res.status(401).json({ succeeded: false }); }
});

router.post('/auth', function (req, res, next) {
	passport.authenticate('local', function (err, user, info) {
		if (err) { return next(err); }
		if (!user) {
			return res.status(401).json({
				'succeeded': false }); }
		req.login(user, function (err) {
			if (err) { return next(err); }
			return res.status(200).json({
				'succeeded': true, 'user': user });
		});
	}) (req, res, next);
});

router.post('/logout', function (req, res, next) {
	if (req.user) {
		req.logout();
		return res.status(200).json({ succeeded: true });
	} else { return res.status(400).json({ succeeded: false }); }
});

module.exports = router;
