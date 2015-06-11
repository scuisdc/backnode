
var mysql = require('mysql');

var config = require('./bkconfig');

var _ = require('underscore');

_.mixin({
	copy_extend: function () {
		// it's awesome to have underscore inside underscore
		//  -- but why JS doesnot have sth. like argument unpacking
		// thus I have to use the fμckiηg apply instead?
		return _.partial(_.extend, { }).apply(this, arguments); }
});

var db_config_common = {
	host : config.db_host,
	user : config.db_username,
	password : config.db_passwd,
	port: config.db_port
};

var db_config_train = _.copy_extend(db_config_common, {
	database: config.dbname_train });

var db_config_usercenter = _.copy_extend(db_config_common, {
	database: config.dbname_usercenter });
	
var get_config = function (config, def) {
	if (config === undefined) {
		return get_config(def, { });
	} else if (typeof config === 'object') {
		return config; // we need a check for properties needed
	} else {
		switch (config.toLowerCase()) {
			case 'train':
				return db_config_train;
				break;
			case 'user':
				return db_config_usercenter;
				break;
			default:
				throw new Error("I'm sorry but I dont know which config u want.");
				break;
		}
	}
}

var connect = function (config) {
	config = get_config(config, db_config_train);
	var connection = mysql.createConnection(config);
	connection.connect(function (e) { });
	return connection;
};

module.exports = {
	connect: connect };
