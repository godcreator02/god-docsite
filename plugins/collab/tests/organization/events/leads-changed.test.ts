import { describe, expect, it } from 'vitest'
import { publishLeadsChanged } from '../../../src/organization/events/leads-changed.js'

describe('发 leads changed', () => {
  it('发到组织的 topic，标题 <组织>/<仓>，正文 leads changed', async () => {
    const sent: Array<{ url: string; init: RequestInit | undefined }> = []
    await publishLeadsChanged(
      async (url, init) => {
        sent.push({ url: String(url), init })
        return new Response('{}')
      },
      'https://ntfy.example.org',
      'hybrid-mmc',
      'firmware',
    )
    expect(sent).toEqual([{ url: 'https://ntfy.example.org/collab-hybrid-mmc', init: { method: 'POST', headers: { Title: 'hybrid-mmc/firmware' }, body: 'leads changed' } }])
  })

  it('ntfy 回的不是 2xx 就报出来', async () => {
    await expect(publishLeadsChanged(async () => new Response('limit', { status: 429 }), 'https://ntfy.example.org', 'hybrid-mmc', 'firmware')).rejects.toThrow(/ntfy 回 HTTP 429 limit/)
  })
})
