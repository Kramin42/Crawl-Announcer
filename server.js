
var http = require('http');
var path = require('path');
var Promise = require("bluebird");

var async = require('async');
var io = require('socket.io-client');
var express = require('express');
var irc = require('irc');
const sequelize_fixtures = require('sequelize-fixtures');

var constants = require("./constants.js")
var util = require("./util.js");
var db = require("./models");

var client;

function init_db() {
    return sequelize_fixtures.loadFile('fixtures/default_channels.yml', db).then(function(){
        db.Channel.all().then(function(channels) {
            console.log('Channels: ' + channels.map(function(chan){return chan.name;}).join(', '));
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
                    client.say(chan, 'average delay recently: ' + delay_avg.toFixed(1) + ' sec');
                }
            }
        });
        
        client.on('error', function(e) {
            console.log(e);
        });
    });
}

function init_socketio() {
    // socketio to get events from the PubSub service
    var socket = io.connect('http://125.238.82.167');
    socket.on('connect', function () { console.log("socket connected"); });
    
    var delay_avg = -1;
    socket.on('crawlevent', function(data) {
        data = JSON.parse(data);
        data.forEach(function(event) {
            var stone = event['data'];
            stone['src'] = event['src_abbr'];
            var announcement = event['type'] == 'milestone' ? util.stone_format(stone) : util.log_format(stone);
            
            db.Channel.all().then(function(channels) {
                channels.forEach(function(channel) {
                    client.say(channel.name, announcement);
                });
            });
            
            //track delay
            var delay = Math.floor(Date.now() / 1000) - parseInt(event['time'])
            if (delay_avg==-1) {delay_avg = delay;}
            else {
                delay_avg = (1.0 - constants.delay_avg_p)*delay_avg + constants.delay_avg_p*delay;
            }
        });
    });
    return Promise.resolve();
}

function init_web() {
    var router = express();
    var server = http.createServer(router);
    router.use(express.static(path.resolve(__dirname, 'client')));
    
    server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
        var addr = server.address();
        console.log("Server listening at", addr.address + ":" + addr.port);
    });
    return Promise.resolve();
}

init_db()
.then(init_irc)
.then(init_socketio)

init_web()
