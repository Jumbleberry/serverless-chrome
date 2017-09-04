import Cdp from 'chrome-remote-interface'
import { log, deleteFromTable, generateError } from '../utils'

const LOAD_TIMEOUT = 1000 * 5
const GLOBAL_LOAD_TIMEOUT = 1000 * 25
const WAIT_FOR_NEW_REQUEST = 1000 * 1
const requestsMade = []
const requestIds = []
const responsesReceived = []
var mainPixelFired = false

var event = null
var context = null
var customeError = null
var client = null

export default (async function firePixelHandler (e, c) {
  var exitTimeout = false
  event = e
  context = c
  customeError = generateError(event, 'Error in firing pixel')

  const [tab] = await Cdp.List()
  client = await Cdp({ host: '127.0.0.1', target: tab })

  const { Network, Page } = client

  setTimeout(() => {
    cleanUpAndExit.catch((err) => {
      throw new Error('Error in cleaning up and exiting')
    })
  }, GLOBAL_LOAD_TIMEOUT)

  Network.requestWillBeSent(params => {
    log('Preparing new request to ' + params.request.url + '...')
    requestsMade.push(params)
    requestIds.push(params.requestId)
    if (exitTimeout != false) {
      log('Clear timeout for clean up and exit')
      clearTimeout(exitTimeout)
    }
  })
  Network.responseReceived(params => {
    log('Receiving new response from ' + params.response.url + '...')
    responsesReceived.push(params)
    requestIds.splice( requestIds.indexOf(params.requestId), 1 )
    if (isSameURL(params.response.url, event['url'])) {
      if (params.response.status == 200) {
        log('Main pixel fired!')
        mainPixelFired = true
      } else {
        mainPixelFired = false
        log('Main pixel failed to fire :(')
        cleanUpAndExit()
        context.fail(customeError)
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
    context.fail(customeError)
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
})

async function cleanUpAndExit() {
  if (requestIds.length == 0) {
    log('Page is loaded.')
  } else {
    log('Page is not fully loaded')
    log('Events didn\'t received response: ', JSON.stringify(requestIds, null, ' '))
  }

  log('Requests made by headless chrome:', JSON.stringify(requestsMade, null, ' '))
  log('Responses received by headless chrome:', JSON.stringify(responsesReceived, null, ' '))

  // It's important that we close the web socket connection,
  // or our Lambda function will not exit properly
  await client.close()
  log('Web socket connection closed.')

  if (mainPixelFired == false) {
    context.fail(customeError)
    throw new Error('Main pixel did not fire :(')
  }

  log('Main pixel fired. Deleting from DynamoDB if it exists...')
  deleteFromTable(event)
}

function isSameURL(urlOne, urlTwo) {
  if (urlOne == urlTwo || urlOne == urlTwo + '/' || urlOne + '/' == urlTwo) {
    return true
  }
  return false
}
