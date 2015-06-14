
// (function (exports) {

var blts = require('./blts');
var _ = require('underscore');

var privileges = {
    'user': 0,
    'superadmin': 1,
    'cms': 2,
    'blog': 3,
    'oj': 4,
    'ctf': 5,
    'task': 6,
    'boarder': 7
};

var default_options = {
    rootname: 'superadmin',
    privfield: 'privilege'
};

var authed = function (bitset, privlist, options) {
    privlist = privlist || privileges;
    options = options || { };
    _(options).defaults(default_options);
    if (typeof bitset === 'object') {
        bitset = bitset[options.privfield]; }
        
    return {
        bitset: function () { return bitset; },
        
        list_privileges: function () { 
            if (this.has_privilege(options.rootname)) {
                return _(privlist).keys(); }
            
            var ret = [ ];
            for (var k in privlist) {
                if (this.has_privilege(k)) {
                    ret.push(k); }
            }
            return ret;
        },
        
        has_privilege: function (priv) {
            priv = priv.toLowerCase();
            if (priv !== options.rootname && this.has_privilege(options.rootname)) {
                return true; }
            return blts.bitset(this.bitset(), privlist[priv]);
        }
    };
};

module.exports = authed;

// }) (typeof exports === 'undefined' ? this['authed'] = {  } : exports);
