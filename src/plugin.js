/// <reference types="cypress" />

// @ts-check
const debug = require('debug')('cypress-testrail-simple')
const got = require('got')
const path = require('path')
const fs = require('fs')
const {
  hasConfig,
  getTestRailConfig,
  getAuthorization,
  getTestRunId,
} = require('../src/get-config')
const { getTestsForRun, uploadAttachment } = require('../src/testrail-api')

async function sendTestResults(testRailInfo, runId, testResults) {
  debug(
    'sending %d test results to TestRail for run %d',
    testResults.length,
    runId,
  )
  const addResultsUrl = `${testRailInfo.host}/index.php?/api/v2/add_results_for_cases/${runId}`
  const authorization = getAuthorization(testRailInfo)
  console.log('testResults', testResults)
  // @ts-ignore
  const response = await got(addResultsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization,
    },
    json: {
      results: testResults,
    },
  }).json()
  debug('TestRail response: %o', response)

  return response
}

function getAllFiles(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach((file) => {
    file = dir + '/' + file
    const stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(file))
    } else {
      results.push(file)
    }
  })
  return results
}

async function uploadScreenshots(caseId, resultId) {
  const SCREENSHOTS_FOLDER_PATH = path.join('./cypress/screenshots')
  debug('uploading screenshots for case %d', caseId)
  try {
    if (fs.existsSync(SCREENSHOTS_FOLDER_PATH)) {
      const files = getAllFiles(SCREENSHOTS_FOLDER_PATH)
      debug('found %d screenshots', files.length)
      debug(files)
      for (const file of files) {
        if (file.includes(`C${caseId}`) && /(failed|attempt)/g.test(file)) {
          try {
            await uploadAttachment(resultId, './' + file)
          } catch (err) {
            console.log('Screenshot upload error: ', err)
          }
        }
      }
    }
  } catch (error) {
    return console.log('Unable to scan screenshots folder: ' + error)
  }
}

/**
 * Registers the cypress-testrail-simple plugin.
 * @example
 *  module.exports = (on, config) => {
 *   require('cypress-testrail-simple/src/plugin')(on)
 *  }
 * @example
 *  Skip the plugin
 *  module.exports = (on, config) => {
 *   require('cypress-testrail-simple/src/plugin')(on, true)
 *  }
 * @param {Cypress.PluginEvents} on Event registration function from Cypress
 * @param {Boolean} skipPlugin If true, skips loading the plugin. Defaults to false
 */
function registerPlugin(on, skipPlugin = false) {
  if (skipPlugin === true) {
    debug('the user explicitly disabled the plugin')
    return
  }

  if (!hasConfig(process.env)) {
    debug('cypress-testrail-simple env variables are not set')
    return
  }

  const testRailInfo = getTestRailConfig()
  const runId = getTestRunId()
  if (!runId) {
    throw new Error('Missing test rail run ID')
  }

  // should we ignore test results if running in the interactive mode?
  // right now these callbacks only happen in the non-interactive mode

  // https://on.cypress.io/after-spec-api
  on('after:spec', (spec, results) => {
    debug('after:spec')
    debug(spec)
    debug(results)

    // find only the tests with TestRail case id in the test name
    const testRailResults = []
    results.tests.forEach((result) => {
      const testRailCaseReg = /C(\d+)\s/
      // only look at the test name, not at the suite titles
      const testName = result.title[result.title.length - 1]
      if (testRailCaseReg.test(testName)) {
        const testRailResult = {
          case_id: parseInt(testRailCaseReg.exec(testName)[1]),
          // TestRail status
          // Passed = 1,
          // Blocked = 2,
          // Untested = 3,
          // Retest = 4,
          // Failed = 5,
          // TODO: map all Cypress test states into TestRail status
          // https://glebbahmutov.com/blog/cypress-test-statuses/
          status_id: result.state === 'passed' ? 1 : 5,
        }
        testRailResults.push(testRailResult)
      }
    })
    if (testRailResults.length) {
      console.log('TestRail results in %s', spec.relative)
      console.table(testRailResults)
      return sendTestResults(testRailInfo, runId, testRailResults)
        .then((runResults) => {
          console.log('TestRail response: %o', runResults)
          getTestsForRun(runId, testRailInfo).then((tests) => {
            if (tests.length) {
              const failedResults = runResults.filter((x) => x.status_id === 5)
              failedResults.forEach(async (result) => {
                const test = tests.find((x) => x.id === result.test_id)
                await uploadScreenshots(test.case_id, result.id)
              })
            }
          })
        })
        .catch((err) => {
          console.error('Error sending TestRail results')
          console.error(err)
        })
    }
  })
}

module.exports = registerPlugin
