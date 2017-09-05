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

export function deleteFromTable (event, name = config.dynamoDBTableName) {
    var AWS = require('aws-sdk');
    var documentClient = new AWS.DynamoDB.DocumentClient();

    var params = {
        TableName: name,
        Key : {
            hid: event['hid']
        }
    };

    documentClient.delete(params, function(err, data) {
        if (err) console.log(err);
        else console.log(data);
    });
}

export function addToTable (event, name = config.dynamoDBTableName) {
    var AWS = require('aws-sdk');
    var documentClient = new AWS.DynamoDB.DocumentClient();

  try {
    var item =
        JSON.parse(
            JSON.parse(
                JSON.parse(
                    event['Cause']
                )['errorMessage']
            )['data']
        );

    var params = {
        TableName: name,
        Item : {
            hid: item['hid'],
            sid: item['sid'],
            transid: item['transid'],
            url: item['url'],
            userAgent: item['useragent']
        }
    }
  }
  catch(err) {
    log('Error in getting data: ', err)
    var params = {
        TableName: name,
        Item : {
            hid: 'UNKNOWN-' + Date.now()
        }
    }
  }

  documentClient.put(params, function(err, data) {
      if (err) console.log(err);
      else console.log(data);
  });
}
