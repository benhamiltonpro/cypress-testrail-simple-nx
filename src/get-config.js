// @ts-check
const debug = require('debug')('cypress-testrail-simple-nx')
const fs = require('fs')
const path = require('path')

function hasConfig(env = process.env) {
  return (
    'TESTRAIL_HOST' in env ||
    'TESTRAIL_USERNAME' in env ||
    'TESTRAIL_PASSWORD' in env ||
    'TESTRAIL_PROJECTID' in env
  )
}

function getTestRailConfig(env = process.env) {
  const debug = require('debug')('cypress-testrail-simple-nx')

  if (!env.TESTRAIL_HOST) {
    throw new Error('TESTRAIL_HOST is required')
  }
  if (!env.TESTRAIL_USERNAME) {
    throw new Error('TESTRAIL_USERNAME is required')
  }
  if (!env.TESTRAIL_PASSWORD) {
    throw new Error('TESTRAIL_PASSWORD is required. Could be an API key.')
  }
  if (!env.TESTRAIL_PROJECTID) {
    throw new Error('TESTRAIL_PROJECTID is required.')
  }

  const testRailInfo = {
    host: process.env.TESTRAIL_HOST,
    username: process.env.TESTRAIL_USERNAME,
    password: process.env.TESTRAIL_PASSWORD,
    projectId: process.env.TESTRAIL_PROJECTID,
    suiteId: process.env.TESTRAIL_SUITEID,
  }
  debug('test rail info with the password masked')
  debug('%o', { ...testRailInfo, password: '<masked>' })

  return testRailInfo
}

function getAuthorization(testRailInfo) {
  const authorization = `Basic ${Buffer.from(
    `${testRailInfo.username}:${testRailInfo.password}`,
  ).toString('base64')}`
  return authorization
}

function getTestRunId(env = process.env) {
  // first, try to read the test run id from the environment
  if ('TESTRAIL_RUN_ID' in env) {
    return parseInt(env.TESTRAIL_RUN_ID)
  }

  const filename = path.join(process.cwd(), 'runId.txt')
  debug('checking file %s', filename)

  if (fs.existsSync(filename)) {
    const s = fs.readFileSync(filename, 'utf8').trim()
    console.log('read "%s"', s)
    return parseInt(s)
  }
  debug('could not find runId.txt in folder %s', process.cwd())
}

module.exports = {
  hasConfig,
  getTestRailConfig,
  getAuthorization,
  getTestRunId,
}
