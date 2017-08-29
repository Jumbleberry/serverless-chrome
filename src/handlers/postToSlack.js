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
        var hid = null;
        var userName = null;
        var iconEmoji = null;

        if (eventName == 'INSERT') {
            hid = data.NewImage.hid.N;
            msg = 'Pixel with hid: `' + hid + '` failed to fire.';
            userName = 'Angry Bot';
            iconEmoji = ':rage:';
        } else if (eventName == 'REMOVE') {
            hid = data.OldImage.hid.N;
            msg = 'Pixel with hid: `' + hid + '` has been successfully fired!';
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

        //send request witht the postData form
        req.write(postData);
        req.end();
    });

    log("Successfully processed " + event.Records.length + " records.");
})
