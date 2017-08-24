import config from './config'
import { spawn as spawnChrome } from './chrome'
import { log, generateError } from './utils'

// eslint-disable-next-line import/prefer-default-export
export function run (event, context, callback, handler = config.handler) {
  spawnChrome().then(function() {
    handler(event, context);
  }).then(function() {
    log('Success!')
  }).catch(function(err) {
    log('Catch any error here:')
    log(err)
    callback(generateError(event, 'Error in firing pixel in headless chrome'))
  }).then(function() {
    log('All done!')
    callback(null, 'Success')
  })
}
