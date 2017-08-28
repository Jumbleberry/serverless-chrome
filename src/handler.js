import config from './config'
import { spawn as spawnChrome } from './chrome'
import { log, generateError, addToTable } from './utils'
import firePixelHandler from './handlers/firePixel'
import postToSlackHandler from './handlers/postToSlack'

// eslint-disable-next-line import/prefer-default-export
export async function firePixel (event, context, callback) {
  var error = null

  try {
    await spawnChrome()
  } catch(err) {
    log('Error in spawning:', err)
    error = generateError(event, 'Error in spawning')
  }

  try {
    await firePixelHandler(event, context)
  } catch(err) {
    log('Error in handler:', err)
    error = generateError(event, 'Error in handler')
  }

  if (error) {
    context.fail(error)
  } else {
    callback(null, 'Success')
  }
}

export function addDeadPixel (event, context, callback) {
  try {
    addToTable(event)
  } catch(err) {
    context.fail(error)
  }

  callback(null, 'Success')
}

export function postToSlack (event, context, callback) {
  try {
    postToSlackHandler(event)
  } catch(err) {
    context.fail(error)
  }

  callback(null, 'Success')
}
