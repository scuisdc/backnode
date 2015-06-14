
var _ = require('underscore');

var blts = { };

var bitset = function (num, bit) {
	return !!((num & (1 << bit)) >> bit); };

var setbit = function (num, bit, x) {
	if (typeof x === 'boolean') {
		x = Number(x); }
	return (num & ~(1 << bit)) | (x << bit); };

blts.bitset = bitset;
blts.setbit = setbit;

blts.join_str = function (num, meta) {
	var ret = [ ];
	for (var i = 0; i < meta.length; i++) {
		if (bitset(num, meta[i].id)) {
			ret.push(meta[i].name); }
	}
	return ret;
};

blts.array_object = function (list, values) {
	return _.map(list, function (l) { return _.object(values, l); }); };

module.exports = blts;
