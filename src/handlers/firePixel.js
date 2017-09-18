import Cdp from 'chrome-remote-interface'
import config from '../config'
import { spawn as spawnChrome, kill as killChrome } from '../chrome'
import { log, deleteFromTable, generateError } from '../utils'

const LOAD_TIMEOUT = 1000 * 15
const GLOBAL_LOAD_TIMEOUT = 1000 * 25
const WAIT_FOR_NEW_REQUEST = 1000 * 1
const PAGE_TIMEOUT_ERROR = 'Page load timed out'

var requestsMade = []
var requestIds = {}
var responsesReceived = []

var client = null
var mainPixelRequestId = null
var mainPixelFired = false
var globalExitTimeout = false
var exitTimeout = false
var finished = false

var event = null
var context = null
var callback = null

export async function firePixelHandler(e, c, cb) {
  initVariables(e, c, cb)

  // let unix_epoch_timestamp = Math.floor(Date.now() / 1000);
  // let metric_value = 1;
  // let metric_type = config.datadogInvocationMetricType;
  // let metric_name = config.datadogInvocationMetricName;
  // log(`MONITORING|${unix_epoch_timestamp}|${metric_value}|${metric_type}|${metric_name}`)

  await spawnChrome()
  const [tab] = await Cdp.List()
  client = await Cdp({ host: '127.0.0.1', target: tab })

  const { Network, Page } = client

  log('Set global time out to exit')
  globalExitTimeout = setTimeout(cleanUpAndExit, GLOBAL_LOAD_TIMEOUT)

  Network.requestWillBeSent(params => {
    if (!requestIds[params.requestId]) {
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
    if (delete requestIds[params.requestId]) {
      log('Receiving new response from ' + params.response.url + '...')
      responsesReceived.push(params)

      if (Object.keys(requestIds).length == 0) {
        log('Set timeout to clean up and exit')
        exitTimeout = setTimeout(cleanUpAndExit, WAIT_FOR_NEW_REQUEST)
      }

      if (mainPixelRequestId == params.requestId) {
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
    await Network.setUserAgentOverride({ userAgent: event['useragent'] })
    await Network.setCacheDisabled({ cacheDisabled: true })
    await Network.canClearBrowserCookies() && await Network.clearBrowserCookies()

    if (event['cookies'] !== undefined) {
      event['cookies'].forEach( async (cookie) => {
        log('Setting cookie...', cookie)
        await Network.setCookie(cookie)
      });
    }

    if (event['headers'] !== undefined) {
      log('Setting headers...', event['headers'])
      await Network.setExtraHTTPHeaders({ headers: event['headers'] })
    }

    await Page.enable()
    await Page.navigate({ url: event['url'] })
    log('Navigating to ', event['url'])

    // wait until page is done loading, or timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        reject,
        LOAD_TIMEOUT,
        new Error(PAGE_TIMEOUT_ERROR)
      )

      loadEventFired.then(async () => {
        clearTimeout(timeout)
        resolve()
      })
    })

  } catch(err) {
    log('Error in setting up Network and Page: ', err)
    cleanUpAndExit()
  }
}

export async function cleanUpAndExit(error = null) {
  if (!finished) {
    finished = true

    log('*** Requests made:', JSON.stringify(requestsMade, null, ' '))
    log('*** Responses received:', JSON.stringify(responsesReceived, null, ' '))
    if (Object.keys(requestIds).length === 0 && requestIds.constructor === Object) {
      log('*** All requests have been processed and received.')
    } else {
      log('*** Requests still waiting: ', JSON.stringify(requestIds, null, ' '))
    }

    // It's important that we close the web socket connection,
    // or our Lambda function will not exit properly
    if (client != null) {
     await client.close()
     log('Web socket connection closed.')
    }

    await killChrome()
    log('Chrome killed.')

    // Make sure to clear out the event loop
    clearTimeout(exitTimeout)
    clearTimeout(globalExitTimeout)

    // Treat page timeout error as normal error
    if (error == 'Error: ' + PAGE_TIMEOUT_ERROR) {
      error = null;
    }

    log('Error: ', error)
    log('mainPixelFired: ', mainPixelFired)

    if (error === null && mainPixelFired === true) {
      log('==================== Main pixel fired. Deleting from DynamoDB if it exists... ====================')
      await deleteFromTable(event)
      // let unix_epoch_timestamp = Math.floor(Date.now() / 1000);
      // let metric_value = 1;
      // let metric_type = config.datadogPixelMetricType;
      // let metric_name = config.datadogPixelMetricName;
      // let tag_list = `campaign:${event['sid']},transid:${event['transid']}`;
      // log(`MONITORING|${unix_epoch_timestamp}|${metric_value}|${metric_type}|${metric_name}|#${tag_list}`)
      context.succeed('Success')
    } else {
      log('==================== Main pixel did not fire :( ====================')
      let customError = generateError(event, 'Error in firing pixel.')
      context.fail(customError)
    }
  }
}

function initVariables(e, c, cb) {
  event = e
  context = c
  callback = cb

  requestsMade = []
  requestIds = {}
  responsesReceived = []

  finished = false
  mainPixelRequestId = null
  mainPixelFired = false
  globalExitTimeout = clearTimeout(false)
  exitTimeout = clearTimeout(false)
}

function isHTTPStatusSuccess(httpStatusCode) {
  return 200 <= httpStatusCode && httpStatusCode <= 299
}
