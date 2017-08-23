import config from './config'
import { spawn as spawnChrome } from './chrome'
import { log, generateError } from './utils'

// eslint-disable-next-line import/prefer-default-export
export function run (event, context, callback, handler = config.handler) {
  asyncRun(event, context, callback, handler)
    .catch(e => { log(e); callback(generateError(event, 'Error in firing pixel in headless chrome')) })
    .then(v => { callback(null, v) })
}

async function asyncRun (event, context, callback, handler) {
  try {
    await spawnChrome()
  } catch (error) {
    throw new Error('Error in spawning Chrome')
  }

  try {
    await handler(event, context)
  } catch (error) {
    throw new Error('Error in handler')
  }
}
