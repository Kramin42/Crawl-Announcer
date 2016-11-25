//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');

var async = require('async');
var io = require('socket.io-client');
var express = require('express');
var irc = require('irc');

var ANNOUNCE_CHAN = '##crawl-announcements'

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);

var DIFFICULTYMAP={'1': 'standard', '2': 'challenge', '3': 'nightmare'};
function stone_format(stone) {
    return stone['name'] + ' (L' + stone['xl'] + ' ' + stone['char'] + ') ' + stone['milestone'] + ' (' + ((stone['oplace'] && stone['milestone'].search('left') == -1) ? stone['oplace'] : stone['place']) + ') ['+stone['src']+' '+stone['v']+(stone['difficulty'] ? ', '+DIFFICULTYMAP[stone['difficulty']] : '')+']';
}

function log_format(stone) {
    var loc_string = '';
    if (stone['ktyp'] != 'winning' && stone['ktyp'] != 'leaving') {
        if (stone['place'].search(':') > -1) {
            loc_string = ' on ' + stone['place'];
        } else {
            loc_string = ' in ' + stone['place'];
        }
    }

    var dur = parseInt(stone['dur']); //need to format correctly
    var duration = pad2(parseInt(dur / 3600)) + ':' + pad2(parseInt(dur / 60) % 60) + ':' + pad2(dur % 60);

    return stone['name'] + ' the ' + stone['title'] + ' (L' + stone['xl'] + ' ' + stone['char'] + ')' + (stone['god'] ? ' worshipper of ' + stone['god'] : '') + ', ' + (stone['vmsg'] !== undefined ? stone['vmsg'] : stone['tmsg']) + loc_string + ', with ' + stone['sc'] + ' points after ' + stone['turn'] + ' turns and ' + duration + '. ['+stone['src']+' '+stone['v']+(stone['difficulty'] ? ', '+DIFFICULTYMAP[stone['difficulty']] : '')+']';
}

// irc client to post results in ##crawl
var irc = new irc.Client('chat.freenode.net', 'Kramell2', {
    channels: ['##kramell', ANNOUNCE_CHAN],
});

// socketio to get events from the PubSub service
var socket = io.connect('http://125.238.82.167');
socket.on('connect', function () { console.log("socket connected"); });
socket.on('crawlevent', function(data) {
    console.log('got crawlevent');
    data = JSON.parse(data);
    data.forEach(function(event) {
        //console.log(event);
        var stone = event['data'];
        stone['src'] = event['src_abbr'];
        var announcement = event['type'] == 'milestone' ? stone_format(stone) : log_format(stone);
        irc.say(ANNOUNCE_CHAN, announcement);
    });
});

router.use(express.static(path.resolve(__dirname, 'client')));

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Server listening at", addr.address + ":" + addr.port);
});
