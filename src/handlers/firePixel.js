import Cdp from 'chrome-remote-interface'
import config from '../config'
import { spawn as spawnChrome, kill as killChrome } from '../chrome'
import { log, deleteFromTable, addFiredPixelToTable, generateError, feedDataDog } from '../utils'

const LOAD_TIMEOUT = 1000 * 15
const GLOBAL_LOAD_TIMEOUT = 1000 * 25
const WAIT_FOR_NEW_REQUEST = 1000 * 1
const PAGE_TIMEOUT_ERROR = 'Page load timed out'

var invocations = 0

var requestsMade = []
var requestIds = {}
var responsesReceived = []

var client = null
var tab = null
var mainPixelRequestId = null
var mainPixelFired = false
var globalExitTimeout = false
var exitTimeout = false
var pageLoadTimeout = false
var finished = false

var event = null
var context = null
var callback = null

export async function firePixelHandler(e, c, cb) {
  initVariables(e, c, cb)

  feedDataDog(
    1,
    config.datadogInvocationMetricType,
    config.datadogInvocationMetricName)

  await spawnChrome()
  tab = await Cdp.New({ url: 'about:blank' })
  client = await Cdp({ host: '127.0.0.1', target: tab })

  const { Network, Page } = client

  log('Set global time out to exit')
  globalExitTimeout = setTimeout(cleanUpAndExit, GLOBAL_LOAD_TIMEOUT)

  Network.requestWillBeSent(params => {
    if (requestIds[params.requestId] !== true) {
      requestIds[params.requestId] = true

      log('Preparing new request to ' + params.request.url + '...')
      requestsMade.push(params)

      if (mainPixelRequestId === null) {
        mainPixelRequestId = params.requestId
      }

      clearTimeout(exitTimeout)
    }
  })

  Network.responseReceived(params => {
    if (requestIds[params.requestId] === true && delete requestIds[params.requestId]) {
      log('Receiving new response from ' + params.response.url + '...')
      responsesReceived.push(params)

      if (Object.keys(requestIds).length === 0) {
        log('Set timeout to clean up and exit')
        exitTimeout = setTimeout(cleanUpAndExit, WAIT_FOR_NEW_REQUEST)
      }

      if (mainPixelRequestId === params.requestId) {
        if (isHTTPStatusSuccess(params.response.status)) {
          log('==================== Main pixel fired! ====================')
          mainPixelFired = true
        } else {
          mainPixelFired = false
          log('==================== Main pixel failed to fire :( The response code was ' + params.response.status + ' ====================')
          cleanUpAndExit()
        }
      }
    }
  })

  const loadEventFired = Page.loadEventFired()

  try {
    await Network.enable()
    await Network.setCacheDisabled({ cacheDisabled: true })
    await Network.setUserAgentOverride({ userAgent: event['useragent'] || '' })
    await Network.canClearBrowserCookies() && await Network.clearBrowserCookies()

    if (typeof event['cookies'] != 'undefined' && event['cookies'] instanceof Array) {
      event['cookies'].forEach( async (cookie) => {
        log('Setting cookie...', cookie)
        await Network.setCookie(cookie)
      });
    }

    if (typeof event['headers'] != 'undefined' && event['headers'] instanceof Array) {
      log('Setting headers...', event['headers'])
      await Network.setExtraHTTPHeaders({ headers: event['headers'] })
    }

    await Page.enable()
    await Page.navigate({ url: event['url'] })
    log('Navigating to ', event['url'])

    // wait until page is done loading, or timeout
    await new Promise((resolve, reject) => {
      pageLoadTimeout = setTimeout(
        reject,
        LOAD_TIMEOUT,
        new Error(PAGE_TIMEOUT_ERROR)
      )

      loadEventFired.then(async () => {
        log('==================== Page load complete ====================')
        clearTimeout(pageLoadTimeout)
        resolve()
      })
    })

  } catch(err) {
    log('Error in setting up Network and Page: ', err)
    cleanUpAndExit(err)
  }
}

export async function cleanUpAndExit(error = null) {
  if (finished !== true) {
    finished = true
    
    // Make sure to clear out the event loop
    clearTimeout(exitTimeout)
    clearTimeout(globalExitTimeout)
    clearTimeout(pageLoadTimeout)

    log('*** Requests made:', JSON.stringify(requestsMade, null, ' '))
    log('*** Responses received:', JSON.stringify(responsesReceived, null, ' '))
    if (Object.keys(requestIds).length === 0 && requestIds.constructor === Object) {
      log('*** All requests have been processed and received.')
    } else {
      log('*** Requests still waiting: ', JSON.stringify(requestIds, null, ' '))
    }

    // It's important that we close the web socket connection,
    // or our Lambda function will not exit properly
    if (client) {
      const { Network, Page } = client
      await Network.disable()
      await Page.disable()
      await Cdp.Close(tab)
      await client.close()
      log('Browser environment discarded')
    }
    
    // Kill chrome every 4 requests, some issue with ECONNREFUSED
    if (invocations >= 4) {
      log('Killing chrome process after ' + invocations + ' invocations')
      invocations = 0
      await killChrome()
      await new Promise((resolve) => { return setTimeout(resolve, 250) })
    }
    
    // Successfully complete if the main pixel fired. Timeouts on other requests are unfortunate, but acceptable.
    if (mainPixelFired === true && (error === null || error === 'Error: ' + PAGE_TIMEOUT_ERROR)) {
      log('==================== Main pixel fired. Adding to backlog table FiredPixels and deleting from DeadPixels if it exists... ====================')
      await addFiredPixelToTable(event);
      await deleteFromTable(event, "DeadPixels");

      feedDataDog(
        1,
        config.datadogPixelMetricType,
        config.datadogPixelMetricName,
        `campaign:${event['sid']},transid:${event['transid']}`);
      
      context.succeed('Success')
    } else {
      log('==================== Main pixel did not fire :( ====================')
      log('Error: ', error)
      let customError = generateError(event, 'Error in firing pixel.')
      context.fail(customError)
    }
  }
}

function initVariables(e, c, cb) {
  ++invocations
  
  client = null
  tab = null

  event = e
  context = c
  callback = cb

  requestsMade = []
  requestIds = {}
  responsesReceived = []

  finished = false
  mainPixelRequestId = null
  mainPixelFired = false
  globalExitTimeout = clearTimeout(globalExitTimeout)
  exitTimeout = clearTimeout(exitTimeout)
  pageLoadTimeout = clearTimeout(pageLoadTimeout)
}

function isHTTPStatusSuccess(httpStatusCode) {
  return 200 <= httpStatusCode && httpStatusCode <= 299
}
