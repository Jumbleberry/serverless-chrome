import config from '../config'

export default (function postToSlackHandler (event) {
    const https = require('https');

    var msg = 'Pixel with hid:' + event['hid'] + ' can not be fired.'

    const postData = querystring.stringify({
      'channel': config.slackWebHookChannel,
      'username': 'Angry Ian',
      'text': msg,
      'icon_emoji': ':scream:'
    });

    const options = {
      hostname: config.slackWebHookHost,
      port: 443,
      path: config.slackWebHookPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      console.log('statusCode:', res.statusCode);
      console.log('headers:', res.headers);

      res.on('data', (d) => {
        process.stdout.write(d);
      });
    });

    req.on('error', (e) => {
      throw new Error(e);
    });
    req.end()
})
