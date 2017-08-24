import config from './config'
import { spawn as spawnChrome } from './chrome'
import { log, generateError } from './utils'

// eslint-disable-next-line import/prefer-default-export
export function run (event, context, callback, handler = config.handler) {
  // let handlerResult = {}

  // spawnChrome().then(() => {
  //   try {
  //     handlerResult = handler(event, context)
  //   } catch(e) {
  //     log(e)
  //     callback(generateError(event, 'Error in firing pixel in headless chrome'))
  //   }
  //   log('Handler result:', JSON.stringify(handlerResult, null, ' '))
  //   log('All done!')
  //   callback(null, 'Success')
  // }).catch((err) => {
  //   log('Error in spawning headless chrome:', err)
  //   callback(generateError(event, 'Error in spawning headless chrome'))
  // })

  spawnChrome().then(() => {
    handler(event, context).then(() => {
      return callback(null, 'Success')
    })
    .catch((e) => {
      log('Error in handler:', e)
      return callback(generateError(event, 'Error in handler'))
    })
  })
  .catch((e) => {
    log('Error in spawning chrome:', e)
    return callback(generateError(event, 'Error in spawning'))
  })

  // spawnChrome().then(function() {
  //   return handler(event, context)
  // }).then(function() {
  //   log('Handler Success')
  // }).catch(function(err) {
  //   log('An error occurred:', err)
  //   callback(generateError(event, 'Error in firing pixel in headless chrome'))
  // }).then(function() {
  //   log('All done!')
  //   callback(null, 'Success')
  // })
}
