import config from './config'
import { log, generateError, addToTable } from './utils'
import { firePixelHandler, cleanUpAndExit } from './handlers/firePixel'
import postToSlackHandler from './handlers/postToSlack'

// eslint-disable-next-line import/prefer-default-export
export async function firePixel (event, context, callback) {
  log('******************* START FIRE PIXEL *******************');
  try {
    await firePixelHandler(event, context, callback)
  } catch(err) {
    log('Error in firePixel: ', err)
    log('cleaning up and exiting...')
    cleanUpAndExit(err)
  }
}

export function addDeadPixel (event, context, callback) {
  log('******************* START ADD DEAD PIXEL *******************');
  try {
    addToTable(event)
  } catch(err) {
    context.fail(err)
  }

  callback(null, 'Success')
}

export function postToSlack (event, context, callback) {
  log('******************* START POST TO SLACK *******************');
  try {
    postToSlackHandler(event, context, callback)
  } catch(err) {
    context.fail(err)
  }

  callback(null, 'Success')
}
