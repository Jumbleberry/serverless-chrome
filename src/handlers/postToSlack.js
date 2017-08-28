import config from '../config'

export default (function postToSlackHandler (event) {
    var https = require('https');

    var eventName = event['Records'][0]['eventName'];
    var hid = event['Records'][0]['dynamodb']['NewImage']['hid']['N'];
    if (eventName == 'INSERT') {
        var msg = 'Pixel with hid:' + hid + ' failed to fire.';
    }

    // form data
    var postData = JSON.stringify({
        channel: config.slackWebHookChannel,
        username: 'Angry Ian',
        text: msg,
        icon_emoji: ':scream:'
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
})
