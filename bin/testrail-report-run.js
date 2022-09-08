#!/usr/bin/env node

// @ts-check

const debug = require('debug')('cypress-testrail-simple-nx')
const { getTestRunId, getTestRailConfig } = require('../src/get-config')
const { getTestRun, closeTestRun } = require('../src/testrail-api')

let runId
const runIdStr = process.argv[2]
if (!runIdStr) {
  debug('TestRail run id not passed via CLI, trying the file')
  runId = getTestRunId()
} else {
  runId = parseInt(runIdStr, 10)
}

if (!runId) {
  console.error('Usage: testrail-report-run.js <number runId>')
  console.error('or pass it in the file runId.txt')
  process.exit(1)
}

const testRailInfo = getTestRailConfig()
debug('test rail info with the password masked')
debug('%o', { ...testRailInfo, password: '<masked>' })
getTestRun(runId, testRailInfo).then((runInfo) => {
  process.stdout.write(JSON.stringify(runInfo))
});