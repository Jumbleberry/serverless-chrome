import config from './config'
import { spawn as spawnChrome } from './chrome'
import { log, generateError } from './utils'

// eslint-disable-next-line import/prefer-default-export
export async function run (event, context, callback, handler = config.handler) {
  let handlerResult = {}
  let handlerError = null

  try {
    await spawnChrome()
  } catch (error) {
    console.error('Error in spawning Chrome')
    handlerError = error
  }

  try {
    handlerResult = await handler(event, context)
  } catch (error) {
    console.error('Error in handler:', error)
    handlerError = generateError(event)
  }

  log('Handler result:', JSON.stringify(handlerResult, null, ' '))

  return callback(handlerError, handlerResult)
}
