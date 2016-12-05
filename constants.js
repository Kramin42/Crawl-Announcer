var env       = process.env.NODE_ENV || 'development';
var config    = require(__dirname + '/config/config.json')[env];

exports.nick = config['irc-nick'];
exports.delay_avg_p= 0.01;
exports.difficulty_map = {"1": "standard", "2": "challenge", "3": "nightmare"};
exports.pubsub_host = "api.crawl.project357.org";
exports.catchup_limit = 10;
