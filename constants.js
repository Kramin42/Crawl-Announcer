var env       = process.env.NODE_ENV || 'development';
var config    = require(__dirname + '/config/config.json')[env];

exports.nick = config['irc-nick'];
exports.sasl = config['sasl'];
exports.password = process.env.NICKSERVPASSWORD || 'password';
exports.delay_avg_p= 0.01;
exports.difficulty_map = {"1": "standard", "2": "challenge", "3": "nightmare"};
exports.pubsub_host = "api.crawl.project357.org";
exports.pubsub_protocol = "https://";
exports.catchup_limit = 50;
exports.admins = ['Kramin','kramin','Kramin42','johnstein','chequers','alexjurkiewicz'];
