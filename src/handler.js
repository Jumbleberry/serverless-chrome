import config from './config'
import { spawn as spawnChrome } from './chrome'
import { log, generateError } from './utils'

// eslint-disable-next-line import/prefer-default-export
export function run (event, context, callback, handler = config.handler) {
  asyncRun(event, context, callback, handler)
    .catch(e => { callback(generateError(event, 'Error in firing pixel in headless chrome')) })
    .then(v => { callback(null, "Success") })
}

async function asyncRun (event, context, callback, handler) {
  let handlerResult = {}

  try {
    await spawnChrome()
  } catch (error) {
    log(error)
    throw new Error('Error in spawning Chrome')
  }

  try {
    handlerResult = await handler(event, context)
  } catch (error) {
    log(error)
    throw new Error('Error in handler')
  }

  log('Handler result:', JSON.stringify(handlerResult, null, ' '))
}
