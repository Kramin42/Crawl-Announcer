var env       = process.env.NODE_ENV || 'development';
var config    = require(__dirname + '/config/config.json')[env];

exports.nick = config['irc-nick'];
exports.sasl = config['sasl'];
exports.password = process.env.NICKSERVPASSWORD || 'password';
exports.delay_avg_p= 0.01;
exports.difficulty_map = {"1": "standard", "2": "challenge", "3": "nightmare"};
exports.pubsub_host = "127.0.0.1:5001";
exports.pubsub_protocol = "http://";
exports.catchup_limit = 50;
exports.admins = ['Kramin','kramin','Kramin42','johnstein','chequers','alexjurkiewicz','gammafunk'];
