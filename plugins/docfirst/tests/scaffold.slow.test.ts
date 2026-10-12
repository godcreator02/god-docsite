import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CREATE_FUMADOCS_APP, readTree, runCreateFumadocsApp } from '../src/scaffold.js'

/**
 * 真运行官方脚手架（要联网），输出要跟 tests/fixtures 下存的样本逐份一致。
 * 升级 CREATE_FUMADOCS_APP 时先运行这条：不一致就用新输出换掉样本，再看本机约定的替换还对不对得上。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.join(here, 'fixtures', `create-fumadocs-app-${CREATE_FUMADOCS_APP.split('@')[1]!}`)

describe('官方脚手架', { tags: ['slow'] }, () => {
  it('输出跟样本一致', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-slow-'))
    try {
      const into = path.join(temp, 'site')
      await runCreateFumadocsApp(into)
      expect(readTree(into)).toEqual(readTree(FIXTURE))
    } finally {
      fs.rmSync(temp, { recursive: true, force: true })
    }
  })
})
