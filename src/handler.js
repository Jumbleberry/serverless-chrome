import config from './config'
import { spawn as spawnChrome } from './chrome'
import { log, generateError } from './utils'

// eslint-disable-next-line import/prefer-default-export
export function run (event, context, callback, handler = config.handler) {
  spawnChrome()
    .catch(e => { callback(generateError(event, 'Error in spawning headless chrome')) })

  handler(event, context)
    .catch(e => { callback(generateError(event, 'Error in firing pixel in headless chrome')) })
    .then(v => { callback(null, v) })
}
