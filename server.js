
var http = require('http');
var path = require('path');
var Promise = require("bluebird");
var request = require('request-promise');

var async = require('async');
var io = require('socket.io-client');
var express = require('express');
var irc = require('irc');
var Sequelize = require('sequelize');
const sequelize_fixtures = require('sequelize-fixtures');

var constants = require("./constants.js");
var util = require("./util.js");
var db = require("./models");

//globals
var clients = {};
//var client;
var delay_avg;
var missed = 0;
var event_index = null; // keeps track of what event I processed last
var catchup_index = -1;
var catchup_done = Promise.resolve(true);

function command(client, cmd, args, chan, nick, authed) {
    var admin = authed && constants.admins.indexOf(nick)>-1;
    console.log('command: ' + cmd + ', args: ' + args + ', admin: ' + admin);

    if (cmd=='stats' && admin) {
        client.say(chan, [
            'average delay recently: ' + delay_avg.toFixed(1) + ' sec',
            'total missed since restart: ' + missed].join('; '));
    }

    if (cmd=='filter' && admin) {
        var help_string = 'Usage: filter <set|show|add|del> [key] [JSON]';
        db.Channel.findOne({where: {name: chan}}).then(function(channel) {
            var filter = JSON.parse(channel.filter)
            if (args.length==0) {
                client.say(chan, help_string);
            } else {
                switch(args[0]) {
                    case 'show':
                        if (args.length==1) client.say(chan, JSON.stringify(filter));
                        else {
                            var subfilter = util.multiindex_get(args[1], filter);
                            client.say(chan, JSON.stringify(subfilter));
                        }
                        break;
                    case 'set':
                        if (args.length<3) client.say(chan, 'Usage: filter set <key> <JSON>');
                        else {
                            try {
                                util.multiindex_set(args[1], filter, JSON.parse(args.slice(2).join(' ')));
                                channel.filter=JSON.stringify(filter);
                                channel.save().then(function(val) {
                                    client.say(chan, args[1]+' set to '+JSON.stringify(util.multiindex_get(args[1], filter)));
                                });
                            } catch(err) {
                                console.log(err);
                                if (err.name=='SyntaxError') {
                                    client.say(chan, args.slice(2).join(' ')+' is not valid JSON');
                                }
                            }
                        }
                        break;
                    case 'add':
                        if (args.length<3) client.say(chan, 'Usage: filter add <key(of list)> <JSON>');
                        else {
                            try {
                                var subfilter = util.multiindex_get(args[1], filter);
                                if (subfilter instanceof Array) {
                                    subfilter.push(JSON.parse(args.slice(2).join(' ')));
                                    channel.filter=JSON.stringify(filter);
                                    channel.save().then(function(val) {
                                        client.say(chan, args[1]+' appended with '+JSON.stringify(util.multiindex_get(args[1], filter).slice(-1)[0]));
                                    });
                                } else {
                                    client.say(chan, 'Error: '+args[1]+' is not a list!');
                                }
                            } catch(err) {
                                console.log(err);
                                if (err.name=='SyntaxError') {
                                    client.say(chan, args.slice(2).join(' ')+' is not valid JSON');
                                }
                            }
                        }
                        break;
                    case 'del':
                        if (args.length<2) client.say(chan, 'Usage: filter del <key>');
                        else {
                            try {
                                var deleted = util.multiindex_del(args[1], filter);
                                channel.filter=JSON.stringify(filter);
                                channel.save().then(function(val) {
                                    client.say(chan, args[1]+' deleted, was '+JSON.stringify(deleted));
                                });
                            } catch(err) {
                                console.log(err);
                            }
                        }
                        break;
                    default:
                        client.say(chan, help_string);
                        break;
                }
            }
        });
    }
}

function handle_message(server, authed, from, to, message) {
	console.log(from+'>'+to+': '+message);
    var chan = to;
    var pm = false;
    var nick = from;
    if (to==constants.nick) {
        chan = from;
        pm = true;
    }
    
    if (message[0]=='$') {
        var args = message.substring(1).split(' ');
        command(clients[server], args[0], args.slice(1), chan, nick, authed);
    }
    
    //various relaying to other ##crawl bots
    db.Channel.findOne({where: {name: chan}}).then(function(channel) {
    	if (channel!=null && channel.relay_enabled) {
		    if (['!','.','=','&','?','^'].indexOf(message[0])!=-1) {// potential sequell query
		    	console.log('relaying sequell query from '+channel.name);
		    	var relay_str = '!RELAY -n 1 -channel '+chan+' -nick '+nick+' -prefix '+server+':'+chan+': '+message;
		    	console.log(relay_str);
		    	clients['chat.freenode.net'].say('Sequell', relay_str);
		    }
		}
    });

    if (pm && nick=='Sequell') {
    	console.log(message);
    	splitmsg = message.split(':');
    	clients[splitmsg[0]].say(splitmsg[1], splitmsg.slice(2).join(':'));
    }
}

function init_db() {
	return db.sequelize.sync().then(function() {
        return db.Channel.all().then(function(channels) {
            if (channels.length==0) {
                console.log('initializing empty db');
                return sequelize_fixtures.loadFile('fixtures/default_channels.yml', db);
            } else {
                return Promise.resolve();
            }
        }).then(function(){
            db.Channel.all().then(function(channels) {
                console.log('Channels: ' + channels.map(function(chan){return chan.name;}).join(', '));
                console.log(channels[0].filter);
            });
        });
    });
}

function init_irc() {
    // irc client to post results in ##crawl
    return db.Channel.findAll({where: {server: 'chat.freenode.net'}}).then(function(channels) {
    	var options = {
    		server: 'chat.freenode.net',
    		nick: constants.nick,
    		sasl: constants.sasl,
        	userName: constants.nick,
        	password: constants.password,
            channels: ['##kramell'].concat(channels.map(function(chan){return chan.name;}))
    	};
        var client = new irc.Client(options.server, options.nick, options);
        
        client.addListener('message', function (from, to, message) {
            var authed = message[0] == '+';
            message = message.substring(1);
            handle_message('chat.freenode.net', authed, from, to, message);
        });

        client.addListener('registered', function(message) {
            client.send('CAP','REQ','identify-msg');
            client.send('CAP','END');
        });
        
        client.on('error', function(e) {
            console.log(e);
        });
        clients['chat.freenode.net'] = client;
    }).then(function() {
    	return db.Channel.findAll({where: {server: 'irc.servercentral.net'}}).then(function(channels) {
	    	var options = {
	    		server: 'irc.servercentral.net',
	    		nick: constants.nick,
	            channels: ['##kramell'].concat(channels.map(function(chan){return chan.name;}))
	    	};
	        var client = new irc.Client(options.server, options.nick, options);
	        
	        client.addListener('message', function (from, to, message) {
	            var authed = true;
	            handle_message('irc.servercentral.net', authed, from, to, message);
	        });

	        // client.addListener('registered', function(message) {
	        //     client.send('CAP','REQ','identify-msg');
	        //     client.send('CAP','END');
	        // });
	        
	        client.on('error', function(e) {
	            console.log(e);
	        });
	        clients['irc.servercentral.net'] = client;
	    });
    });
}

function process_crawlevent(event) {
    console.log(event['id']);
    if (event['id']==null) {console.log('Error: got event with id: null');}
    if (event['id']>catchup_index) {// don't double announce after catchup
        //track delay
        var delay = Math.floor(Date.now() / 1000) - parseInt(event['time']);
        if (delay_avg==null) {delay_avg = delay;}
        else {
            delay_avg = (1.0 - constants.delay_avg_p)*delay_avg + constants.delay_avg_p*delay;
        }

        //add delay to stone data
        event['data']['delay'] = delay;
        
        //track missed
        if (event_index!=null) {
            if (event['id']>event_index) {// gone forward
                var missed_delta = event['id']-(event_index+1);
                if (missed_delta>0) {console.log('missed '+missed_delta+' from '+(event_index+1));}
                missed+= missed_delta;
                //update event_index
                event_index = event['id'];
            }
            if (event['id']<event_index) {// a late event
                missed-= 1;
            }
        } else {
            event_index = event['id'];
        }

        db.Channel.all().then(function(channels) {
            util.announce(clients, channels, event);
        });
    } else {
        console.log('skipping event '+event['id']);
    }
}

function init_socketio() {
    // socketio to get events from the PubSub service
    var socket = io.connect(constants.pubsub_host);
    socket.on('connect', function () {
        console.log('socket connected');
        if (event_index!=null) {
            catchup_done = request(
                {baseUrl: constants.pubsub_protocol+constants.pubsub_host,
                url: '/event',
                qs: {offset: event_index, limit: constants.catchup_limit},
                resolveWithFullResponse: true
                })
            .then(function (response) {
                if (response.statusCode != 200)
                    throw new Error('Unsuccessful attempt. Code: ' + response.statusCode);
                console.log('/event responded');
                var events = JSON.parse(response.body)['results'];
                events.forEach(process_crawlevent);
                catchup_index = events[events.length-1]['id'];
                return true;
            }).catch(console.error);
        }
    });
    
    socket.on('error', function(err) {
        console.log("Caught socketio error: ");
        console.log(err.stack);
    });
    
    socket.on('crawlevent', function(data) {
        console.log('got crawlevent');
        data = JSON.parse(data);
        catchup_done.then(function() {
            console.log('announcing from crawlevent');
            data.forEach(process_crawlevent);
        });
    });
}

function init_web() {
    var router = express();
    var server = http.createServer(router);
    router.use(express.static(path.resolve(__dirname, 'client')));
    
    server.listen(process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080, process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1', function(){
        var addr = server.address();
        console.log("Server listening at", addr.address + ":" + addr.port);
    });
    
    server.on('error', function (err) {
        console.log("Caught server error:");
        console.log(err.stack);
    });
}

init_db()
.then(init_irc)
.then(init_socketio);

init_web();
