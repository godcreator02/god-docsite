#!/usr/bin/env node
import { runMergeCheckCli } from './merge-check.js'

const result = await runMergeCheckCli(process.argv.slice(2), process.cwd())
;(result.exitCode === 0 ? console.log : console.error)(result.output)
process.exitCode = result.exitCode
