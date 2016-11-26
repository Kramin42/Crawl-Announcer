var constants = require("./constants.js")

function pad2(number) {
    return (number < 10 ? '0' : '') + number;
}

function stone_format(stone) {
    return stone['name'] + ' (L' + stone['xl'] + ' ' + stone['char'] + ') ' + stone['milestone'] + ' (' + ((stone['oplace'] && stone['milestone'].search('left') == -1) ? stone['oplace'] : stone['place']) + ') ['+stone['src']+' '+stone['v']+(stone['difficulty'] ? ', '+constants.difficulty_map[stone['difficulty']] : '')+']';
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
    
    return stone['name'] + ' the ' + stone['title'] + ' (L' + stone['xl'] + ' ' + stone['char'] + ')' + (stone['god'] ? ' worshipper of ' + stone['god'] : '') + ', ' + (stone['vmsg'] !== undefined ? stone['vmsg'] : stone['tmsg']) + loc_string + ', with ' + stone['sc'] + ' points after ' + stone['turn'] + ' turns and ' + duration + '. ['+stone['src']+' '+stone['v']+(stone['difficulty'] ? ', '+constants.difficulty_map[stone['difficulty']] : '')+']';
}

function filter(stone, channel) {
    return true; // TODO: add filtering system
}

function colour(announcement, stone, channel) {
    return announcement; // TODO: add colouring system
}

function announce(client, channels, event) {
    var stone = event['data'];
    stone['src'] = event['src_abbr'].toUpperCase();
    var announcement = event['type'] == 'milestone' ? stone_format(stone) : log_format(stone);
    //antiping (disabled)
    //announcement = [announcement[0], announcement.slice(1)].join('\u200B');
    channels.forEach(function(channel) {
        if (filter(stone, channel)) {
            client.say(channel.name, colour(announcement, stone, channel));
        }
    });
}

exports.log_format = log_format;
exports.stone_format = stone_format;
exports.filter = filter;
exports.colour = colour;
exports.announce = announce;
