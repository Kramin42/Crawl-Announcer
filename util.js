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
}

exports.log_format = log_format;
exports.stone_format = stone_format;
