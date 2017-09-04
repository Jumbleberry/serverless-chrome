import Cdp from 'chrome-remote-interface'
import { spawn as spawnChrome } from '../chrome'
import { log, deleteFromTable, generateError } from '../utils'

const LOAD_TIMEOUT = 1000 * 5
const GLOBAL_LOAD_TIMEOUT = 1000 * 25
const WAIT_FOR_NEW_REQUEST = 1000 * 1

const requestsMade = []
const requestIds = []
const responsesReceived = []

var chrome = null
var client = null
var mainPixelFired = false
var globalExitTimeout = false
var exitTimeout = false

var event = null
var context = null
var callback = null

export async function firePixelHandler(e, c, cb) {
  event = e
  context = c
  callback = cb

  chrome = await spawnChrome()
  const [tab] = await Cdp.List()
  client = await Cdp({ host: '127.0.0.1', target: tab })

  const { Network, Page } = client
  let mainPixelRequestId = null

  log('Set global time out to exit')
  globalExitTimeout = setTimeout(cleanUpAndExit, GLOBAL_LOAD_TIMEOUT)

  Network.requestWillBeSent(params => {
    log('Preparing new request to ' + params.request.url + '...')
    requestsMade.push(params)
    requestIds.push(params.requestId)
    if (mainPixelRequestId === null) {
      mainPixelRequestId = params.requestId
    }
    clearTimeout(exitTimeout)
  })

  Network.responseReceived(params => {
    log('Receiving new response from ' + params.response.url + '...')
    responsesReceived.push(params)
    requestIds.splice( requestIds.indexOf(params.requestId), 1 )

    if (mainPixelRequestId == params.requestId) {
      if (params.response.status == 200) {
        log('Main pixel fired!')
        mainPixelFired = true
      } else {
        mainPixelFired = false
        log('Main pixel failed to fire :(')
        cleanUpAndExit()
      }
    }

    if (requestIds.length == 0) {
      log('Set timeout to clean up and exit')
      exitTimeout = setTimeout(cleanUpAndExit, WAIT_FOR_NEW_REQUEST)
    }
  })

  const loadEventFired = Page.loadEventFired()

  try {
    await Network.setUserAgentOverride({ userAgent: event['userAgent'] })
    await Network.enable()
    await Page.enable()
    await Page.navigate({ url: event['url'] })
    log('Navigating to ', event['url'])
  } catch(err) {
    log('Error in enabling network and page, navigating to URL: ', err)
    cleanUpAndExit()
  }

  // wait until page is done loading, or timeout
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      reject,
      LOAD_TIMEOUT,
      new Error(`Page load timed out after ${LOAD_TIMEOUT} ms.`)
    )

    loadEventFired.then(async () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

export async function cleanUpAndExit(error = null) {
  // Make sure to clear out the event loop
  clearTimeout(exitTimeout)
  clearTimeout(globalExitTimeout)

  log('Requests made by headless chrome:', JSON.stringify(requestsMade, null, ' '))
  log('Responses received by headless chrome:', JSON.stringify(responsesReceived, null, ' '))

  // It's important that we close the web socket connection,
  // or our Lambda function will not exit properly
  !client || (await client.close() && log('Web socket connection closed.'))
  !chrome || (await chrome.kill() && log('Chrome instance killed.'))

  if (error === null && mainPixelFired === true) {
    log('Main pixel fired. Deleting from DynamoDB if it exists...')
    deleteFromTable(event)
    context.succeed('Success')
    callback(null, 'success')
  } else {
    log('Main pixel did not fire :(')
    let customError = generateError(event, 'Error in firing pixel.')
    context.fail(customError)
    callback(customError)
  }
}
