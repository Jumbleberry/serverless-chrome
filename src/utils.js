import ps from 'ps-node'
import config from './config'

export function log (...stuffToLog) {
  if (config.logging) console.log(...stuffToLog)
}

export function psLookup (options = { command: '' }) {
  return new Promise((resolve, reject) => {
    ps.lookup(options, (error, result) => {
      log('ps.lookup result:', error, result)

      if (error) {
        return reject(error)
      }
      return resolve(result)
    })
  })
}

export function psKill (options = { command: '' }) {
  return new Promise((resolve, reject) => {
    ps.lookup(options, (error, result) => {
      if (error) {
        return reject(error)
      }
      return resolve(result)
    })
  })
}

export function sleep (miliseconds = 1000) {
  return new Promise(resolve => setTimeout(() => resolve(), miliseconds))
}

export function generateError (event, msg) {
    function PixelFailsToFireError(message, data) {
        this.name = "PixelFailsToFireError";
        this.message = JSON.stringify({"message": message, "data": data});
    }
    PixelFailsToFireError.prototype = new Error();

    return new PixelFailsToFireError(msg, JSON.stringify(event, null, '  '));
}

export function removeFromDeadPixels (event) {
    var AWS = require('aws-sdk');
    var documentClient = new AWS.DynamoDB.DocumentClient();

    var params = {
        TableName: config.dynamoDBTableName,
        Key : {
            hid: event['hid']
        }
    };

    documentClient.delete(params, function(err, data) {
        if (err) console.log(err);
        else console.log(data);
    });
}
