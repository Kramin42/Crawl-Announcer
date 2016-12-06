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

function match_filter(stone, filter) {
    //console.log('matching '+JSON.stringify(stone)+'\n to \n'+JSON.stringify(filter));
    for (var key in filter) {
        // skip loop if the property is from prototype
        if (!filter.hasOwnProperty(key)) continue;
        //console.log('key: '+key);
        switch (key) {
            case '$and':
                if (!filter[key].every(function(subfilter) {return match_filter(stone, subfilter);}))
                    //console.log('failed key: '+key+', value: '+JSON.stringify(filter[key]));
                    return false;
                break;
            case '$or':
                if (!filter[key].some(function(subfilter) {return match_filter(stone, subfilter);}))
                    //console.log('failed key: '+key+', value: '+JSON.stringify(filter[key]));
                    return false;
                break;
            case '$not':
                if (match_filter(stone, filter[key])) {
                    //console.log('failed key: '+key+', value: '+JSON.stringify(filter[key]));
                    return false;
                }
                break;
            
            default:
                if (key in stone) {
                    //console.log('matching value '+JSON.stringify(stone[key])+' to '+JSON.stringify(filter[key]));
                    if (typeof filter[key] === 'string') {
                        if (stone[key]!=filter[key]) {
                            //console.log('failed key: '+key+', value: '+filter[key]+', was: '+stone[key]);
                            return false;
                        }
                    } else {
                        var op = Object.keys(filter[key])[0];
                        switch (op) {
                            case '$in':
                                if (filter[key][op].indexOf(stone[key])==-1) {
                                    //console.log('failed key: '+key+', value: '+JSON.stringify(filter[key])+', was: '+stone[key]);
                                    return false;
                                }
                                break;
                            case '$gt':
                                if (stone[key]<=filter[key][op]) {
                                    //console.log('failed key: '+key+', value: '+JSON.stringify(filter[key])+', was: '+stone[key]);
                                    return false;}
                                break;
                            case '$lt':
                                if (stone[key]>=filter[key][op]) {
                                    //console.log('failed key: '+key+', value: '+JSON.stringify(filter[key])+', was: '+stone[key]);
                                    return false;}
                                break;
                            case '$neq':
                                if (stone[key]==filter[key][op]) {
                                    //console.log('failed key: '+key+', value: '+filter[key]+', was: '+stone[key]);
                                    return false;}
                                break;
                            
                            default:
                                //console.log('failed because not string or op, key: '+key+', value: '+filter[key]+', typeof value: '+(typeof filter[key]));
                                return false;
                        }
                    }
                } else {
                    //console.log('failed because key not found: '+key);
                    return false;
                }
        }
    }
    return true;
}

function filter(stone, channel) {
    try {
        var filter = JSON.parse(channel.filter);
        //console.log('matching:\n'+JSON.stringify(stone));
        return match_filter(stone, filter);
    } catch (err) {
        console.log(err);
        return false;
    }
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

function multiindex_get(key, obj) {
    keys = key.split('.');
    sub = obj;
    for (var i=0; i<keys.length; i++) {
        sub = sub[keys[i]];
    }
    return sub;
}

function multiindex_set(key, obj, val) {
    keys = key.split('.');
    sub = obj;
    for (var i=0; i<keys.length-1; i++) {
        sub = sub[keys[i]];
    }
    sub[keys[keys.length-1]] = val;
    return obj;
}

function multiindex_del(key, obj) {
    keys = key.split('.');
    sub = obj;
    for (var i=0; i<keys.length-1; i++) {
        sub = sub[keys[i]];
    }
    var deleted;
    if (sub instanceof Array) {
        deleted = sub.splice(keys[keys.length-1], 1)[0];
    } else {
        deleted = sub[keys[keys.length-1]];
        delete sub[keys[keys.length-1]];
    }
    return deleted;
}

exports.log_format = log_format;
exports.stone_format = stone_format;
exports.filter = filter;
exports.colour = colour;
exports.announce = announce;
exports.multiindex_get = multiindex_get;
exports.multiindex_set = multiindex_set;
exports.multiindex_del = multiindex_del;
