import Cdp from 'chrome-remote-interface'
import { log, removeFromDeadPixels } from '../utils'

const LOAD_TIMEOUT = 1000 * 30

export default (async function firePixelHandler (event) {
  const requestsMade = []

  const [tab] = await Cdp.List()
  const client = await Cdp({ host: '127.0.0.1', target: tab })

  const { Network, Page } = client

  Network.requestWillBeSent(params => requestsMade.push(params))

  const loadEventFired = Page.loadEventFired()

  try {
    await Network.setUserAgentOverride({ userAgent: event['userAgent'] })
    await Network.enable()
    await Page.enable()
    await Page.navigate({ url: event['url'] })

    log('Navigating to ', event['url'])
  } catch(err) {
    throw new Error(err)
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

  log('Page is loaded.')

  // It's important that we close the web socket connection,
  // or our Lambda function will not exit properly
  await client.close()
  log('Web socket connection closed.')

  removeFromDeadPixels(event)
  // log('firePixelHandler result:', JSON.stringify(requestsMade, null, ' '))

  return {
    statusCode: 200,
    body: JSON.stringify({
      requestsMade,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  }
})
