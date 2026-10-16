import { describe, expect, it } from 'vitest'
import { linkedThreadIdOf } from '../src/site/comment-link.js'

describe('linkedThreadIdOf', () => {
  it('地址点名的串在这一页上就回它的 id', () => {
    expect(linkedThreadIdOf('?comment=20261016t104830-r280', ['a', '20261016t104830-r280'])).toBe('20261016t104830-r280')
  })

  it('没点名、或点名的串不在这一页，回 null', () => {
    expect(linkedThreadIdOf('', ['a'])).toBeNull()
    expect(linkedThreadIdOf('?x=1', ['a'])).toBeNull()
    expect(linkedThreadIdOf('?comment=gone', ['a'])).toBeNull()
  })
})
