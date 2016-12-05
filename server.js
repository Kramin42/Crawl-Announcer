
var http = require('http');
var path = require('path');
var Promise = require("bluebird");
//var request = require('bluebird').promisifyAll(require('request'));
var request = require('request-promise');

var async = require('async');
var io = require('socket.io-client');
var express = require('express');
var irc = require('irc');
const sequelize_fixtures = require('sequelize-fixtures');

var constants = require("./constants.js");
var util = require("./util.js");
var db = require("./models");

//globals
var client;
var delay_avg;
var missed = 0;
var event_index; // keeps track of what event I processed last
var catchup_done = Promise.resolve(true);

function init_db() {
    return sequelize_fixtures.loadFile('fixtures/default_channels.yml', db).then(function(){
        db.Channel.all().then(function(channels) {
            console.log('Channels: ' + channels.map(function(chan){return chan.name;}).join(', '));
            console.log(channels[0].filter);
        });
    });
}

function init_irc() {
    // irc client to post results in ##crawl
    return db.Channel.all().then(function(channels) {
        client = new irc.Client('chat.freenode.net', constants.nick, {
            channels: ['##kramell'].concat(channels.map(function(chan){return chan.name;}))
        });
        
        client.addListener('message', function (from, to, message) {
            var chan = to;
            var pm = false;
            if (to==constants.nick) {
                chan = from;
                pm = true;
            }
            
            if (message[0]=='$') {
                var args = message.substring(1).split();
                console.log('command: ' + args);
                if (args[0]=='stats') {
                    client.say(chan, [
                        'average delay recently: ' + delay_avg.toFixed(1) + ' sec',
                        'total missed since restart: ' + missed].join('; '));
                }
            }
        });
        
        client.on('error', function(e) {
            console.log(e);
        });
    });
}

function process_crawlevent(event) {
    console.log(event['id']);
    if (event['id']==null) {console.log('Error: got event with id: null');}
    if (event_index==null || event_index<event['id']) {// don't double announce
        db.Channel.all().then(function(channels) {
            util.announce(client, channels, event);
        });
        
        //track delay
        var delay = Math.floor(Date.now() / 1000) - parseInt(event['time']);
        if (delay_avg==null) {delay_avg = delay;}
        else {
            delay_avg = (1.0 - constants.delay_avg_p)*delay_avg + constants.delay_avg_p*delay;
        }
        
        //track missed
        if (event_index!=null)
            missed+= event['id']-(event_index+1);
        
        //update event_index
        event_index = event['id'];
    }
}

function init_socketio() {
    // socketio to get events from the PubSub service
    var socket = io.connect(constants.pubsub_host);
    socket.on('connect', function () {
        console.log('socket connected');
        if (event_index!=null) {
            catchup_done = request(
                {baseUrl: constants.pubsub_host,
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

// TODO: use a better way of keeping it up
// not restarting could leave it in a broken state
// need to find out how to catch the ECONNRESET errors
process.on('uncaughtException', function (err) {
    console.error(err.stack);
    console.log("Node NOT Exiting...");
});
