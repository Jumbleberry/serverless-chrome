import config from './config'
import { spawn as spawnChrome } from './chrome'
import { log, generateError } from './utils'

// eslint-disable-next-line import/prefer-default-export
export async function run (event, context, callback, handler = config.handler) {
  let handlerResult = {}

  try {
    await spawnChrome()
  } catch (error) {
    console.error('Error in spawning Chrome')
    return callback(error)
  }

  try {
    handlerResult = await handler(event, context)
  } catch (error) {
    console.error('Error in handler:', error)
    return callback(generateError(event))
  }

  log('Handler result:', JSON.stringify(handlerResult, null, ' '))

  return callback(null, handlerResult)
}
