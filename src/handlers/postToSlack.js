import config from '../config'
import { log } from '../utils'

export default (function postToSlackHandler (event) {
    var https = require('https');

    event.Records.forEach(record => {
        var eventId = record.eventID
        var eventName = record.eventName
        var data = record.dynamodb
        log('Event ID: ' + eventId)
        log('Event name: ' + eventName)
        log('Dynamodb Record: %j', data)

        var msg = null;
        var id = null;
        var ids = null;
        var hid = null;
        var sid = null;
        var userName = null;
        var iconEmoji = null;

        if (eventName == 'INSERT') {
            id = data.NewImage.id.S;
            if (id.startsWith('UNKNOWN-')) {
                msg = 'Uh oh, no data available about this event. We only know time stamp: `' + id.substring(8) + '`'
            } else {
                ids = id.split("-");
                hid = ids[0];
                sid = ids[1];
                msg = `Pixel with hid: \`${hid}\` and sid: \`${sid}\` failed to fire.`;
            }
            userName = 'Angry Bot';
            iconEmoji = ':rage:';
        } else if (eventName == 'REMOVE') {
            id = data.OldImage.id.S;
            ids = id.split("-");
            hid = ids[0];
            sid = ids[1];
            msg = `Pixel with hid: \`${hid}\` and sid: \`${sid}\` has been successfully fired!`;
            userName = 'Happy Bot';
            iconEmoji = ':stuck_out_tongue_winking_eye:';
        }
        msg += '\n Event ID: `' + eventId + '`';

        // form data
        var postData = JSON.stringify({
            channel: config.slackWebHookChannel,
            username: userName,
            text: msg,
            icon_emoji: iconEmoji
        });

        // request option
        var options = {
            host: config.slackWebHookHost,
            port: 443,
            method: 'POST',
            path: config.slackWebHookPath,
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData)
            }
        };

        // request object
        var req = https.request(options, function (res) {
          var result = '';
          res.on('data', function (chunk) {
            result += chunk;
          });
          res.on('end', function () {
            console.log(result);
          });
          res.on('error', function (err) {
            console.log(err);
          })
        });

        // req error
        req.on('error', function (err) {
          console.log(err);
        });

        //send request with the postData form
        req.write(postData);
        req.end();
    });

    log("Successfully processed " + event.Records.length + " records.");
})
