import config from './config'
import { spawn as spawnChrome } from './chrome'
import { log, generateError } from './utils'

// eslint-disable-next-line import/prefer-default-export
export async function run (event, context, callback, handler = config.handler) {
  var error = null

  try {
    await spawnChrome()
  } catch(err) {
    log('Error in spawning:', err)
    error = generateError(event, 'Error in spawning')
  }

  try {
    await handler(event, context)
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
