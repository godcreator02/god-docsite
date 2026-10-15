import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

export const stepTimeoutMs = 30_000

/** 一项检查：body 返回 { pass, detail }；抛错记为失败，不中断后面的项 */
export function checkRunner(results) {
  return async function check(name, body) {
    const startedAt = Date.now()
    try {
      const { pass, detail } = await body()
      results.push({ name, pass: Boolean(pass), detail, ms: Date.now() - startedAt })
    } catch (error) {
      results.push({ name, pass: false, detail: `抛错：${String(error?.message ?? error).split('\n').slice(0, 3).join(' ')}`, ms: Date.now() - startedAt })
    }
  }
}

/** 页面上的控制台报错、警告、未捕获异常与 4xx/5xx 响应都记进 problems */
export function watchPage(page, label, problems) {
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(`[${label} console.${message.type()}] ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`[${label} pageerror] ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`[${label} http ${response.status()}] ${response.url()}`)
  })
}

/** 每轮检查最后的两项：只有一份 fumadocs、控制台无报错 */
export function problemResults(problems) {
  const frameworkProviderErrors = problems.filter((line) => line.includes('FrameworkProvider'))
  return [
    { name: '只有一份 fumadocs（无 FrameworkProvider 报错）', pass: frameworkProviderErrors.length === 0, detail: `${frameworkProviderErrors.length} 条` },
    { name: '控制台无报错、无 4xx/5xx', pass: problems.length === 0, detail: problems.length === 0 ? '无' : problems.slice(0, 12).join('\n') },
  ]
}

export async function waitForHydrated(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel)
      return element !== null && Object.keys(element).some((key) => key.startsWith('__reactProps'))
    },
    selector,
    { timeout: stepTimeoutMs },
  )
}

export async function headingOf(page) {
  return (await page.locator('h1').first().textContent({ timeout: stepTimeoutMs }))?.trim()
}

/** 在页面上记一个标记：整页刷新后标记就没了 */
export async function markNoReload(page) {
  await page.evaluate(() => {
    window.__e2eNoReload = 'kept'
  })
}

export async function stillNoReload(page) {
  return (await page.evaluate(() => window.__e2eNoReload)) === 'kept'
}

export async function hasViteErrorOverlay(page) {
  return page.evaluate(() => document.querySelector('vite-error-overlay') !== null)
}

export function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? filesUnder(full) : [full]
  })
}
