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

export async function deleteFromTable (event, name = config.dynamoDBTableName) {
    var AWS = require('aws-sdk');
    var documentClient = new AWS.DynamoDB.DocumentClient();

    var params = {
        TableName: name,
        Key : {
            id: event['hid'] + '-' + event['sid']
        }
    };

    var deleteObjectPromise = documentClient.delete(params).promise();
    deleteObjectPromise.then( data => {
      log('Successfully deleting from DynamoDB table.')
    }).catch( err => {
      log('Failed to delete from DynamoDB table, error: ', err)
    });
}

export async function addToTable (event, name = config.dynamoDBTableName) {
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
            id: item['hid'] + '-' + item['sid'],
            hid: item['hid'],
            sid: item['sid'],
            transid: item['transid'],
            url: item['url'],
            useragent: item['useragent'],
            created: Date()
        }
    }
  }
  catch(err) {
    log('Error in getting data: ', err)
    var params = {
        TableName: name,
        Item : {
            id: 'UNKNOWN-' + Date.now()
        }
    }
  }

  var putObjectPromise = documentClient.put(params).promise();
  putObjectPromise.then( data => {
    log('Successfully adding to DynamoDB table.')
  }).catch( err => {
    log('Failed to add to DynamoDB table, error: ', err)
  });
}

export function feedDataDog (value, type, name, tags = null) {
  // Only log production metric
  log('Current deployment stage is ' + process.env.stage);
  if (process.env.stage != 'prod' ) {
    return;
  }
  let unix_epoch_timestamp = Math.floor(Date.now() / 1000);
  let metric = `MONITORING|${unix_epoch_timestamp}|${value}|${type}|${name}`;
  if (tag != null) {
    metric += `|#${tags}`;
  }
  log(metric)
}
