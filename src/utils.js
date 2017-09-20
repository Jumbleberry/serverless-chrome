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
    ps.lookup(options, async (error, result) => {
      try {
        log('PS lookup result: ', JSON.stringify(result, null, ' '));
        if (error) throw error;

        const promisesToAwait = [];
        result.forEach(process => {
          promisesToAwait.push(new Promise((resolve, reject) => {
            ps.kill(process.pid, {signal: 'SIGKILL', timeout: 5}, (err) => {
              return err? reject(err): resolve(process.pid)
            })
          }))
        })

        await Promise.all(promisesToAwait)
      } catch(error) {
        log('Error in killing process: ', error)
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

export async function deleteFromTable (event, name = "DeadPixels") {
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

export async function addFiredPixelToTable (item, name = "FiredPixels") {
  try {
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
    log('Error in getting data for fired pixel: ', err)
    var params = {
        TableName: name,
        Item : {
            id: 'UNKNOWN-' + Date.now()
        }
    }
  }

  await addToTable(params);
}

export async function addDeadPixelToTable (event, name = "DeadPixels") {
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
    log('Error in getting data for dead pixel: ', err)
    var params = {
        TableName: name,
        Item : {
            id: 'UNKNOWN-' + Date.now()
        }
    }
  }

  await addToTable(params);
}

export async function addToTable (params) {
  var AWS = require('aws-sdk');
  var documentClient = new AWS.DynamoDB.DocumentClient();

  var putObjectPromise = documentClient.put(params).promise();
  putObjectPromise.then( data => {
    log('Successfully adding to DynamoDB table.')
  }).catch( err => {
    log('Failed to add to DynamoDB table, error: ', err)
  });
}

export function feedDataDog (value, type, name, tags = null) {
  // Only log production metric
  if (process.env.stage != 'prod' ) {
    return;
  }
  let unix_epoch_timestamp = Math.floor(Date.now() / 1000);
  let metric = `MONITORING|${unix_epoch_timestamp}|${value}|${type}|${name}`;
  if (tags != null) {
    metric += `|#${tags}`;
  }
  log(metric)
}
