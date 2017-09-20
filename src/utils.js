import ps from 'ps-node'
import config from './config'

export function log (...stuffToLog) {
  if (config.logging) console.log(...stuffToLog)
}

export function psLookup (options = { command: '' }) {
  return new Promise((resolve, reject) => {
    ps.lookup(options, (error, result) => {
      log('ps.lookup result:', error, result)

      if (error) {
        return reject(error)
      }
      return resolve(result)
    })
  })
}

export function psKill (options = { command: '' }) {
  return new Promise((resolve, reject) => {
    ps.lookup(options, (error, result) => {
      if (error) {
        return reject(error)
      }
      
      const promisesToAwait = [];
      result.forEach(process => {
        promisesToAwait.push(new Promise((resolve, reject) => {
          ps.kill(process.pid, {signal: 'SIGKILL', timeout: 1}, function( err ) {
            return err? reject(err): resolve(process.pid)
          })
        })
      })
                             
      await Promise.all(promisesToAwait)
      return resolve(result)
    })
  })
}

export function sleep (miliseconds = 1000) {
  return new Promise(resolve => setTimeout(() => resolve(), miliseconds))
}
