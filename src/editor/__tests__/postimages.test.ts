import { describe, expect, it } from 'vitest'
import { normaliseImageUrl } from '../postimages'

describe('normaliseImageUrl', () => {
  it('passes a direct postimages link through', () => {
    const url = 'https://i.postimg.cc/TPg0hk3q/Leg-Press.png'
    expect(normaliseImageUrl(url)).toBe(url)
  })

  it('turns a share link into a direct link', () => {
    // The filename segment is ignored by the service, which is what makes this
    // possible without fetching the page — and the page has no CORS anyway.
    expect(normaliseImageUrl('https://postimg.cc/jCGnZ34t')).toBe(
      'https://i.postimg.cc/jCGnZ34t/img.png',
    )
    expect(normaliseImageUrl('https://www.postimg.cc/jCGnZ34t/')).toBe(
      'https://i.postimg.cc/jCGnZ34t/img.png',
    )
  })

  it('accepts a bare id', () => {
    expect(normaliseImageUrl('jCGnZ34t')).toBe('https://i.postimg.cc/jCGnZ34t/img.png')
  })

  it('upgrades a direct link to https', () => {
    expect(normaliseImageUrl('http://i.postimg.cc/abc123/x.png')).toBe(
      'https://i.postimg.cc/abc123/x.png',
    )
  })

  it('passes any other https url through unchanged', () => {
    expect(normaliseImageUrl('https://example.com/squat.webp')).toBe(
      'https://example.com/squat.webp',
    )
  })

  it('trims surrounding whitespace from a paste', () => {
    expect(normaliseImageUrl('  https://postimg.cc/jCGnZ34t  ')).toBe(
      'https://i.postimg.cc/jCGnZ34t/img.png',
    )
  })

  it('rejects empty input and anything that is not a url', () => {
    for (const input of ['', '   ', 'not a url', 'ftp://x/y', 'http://example.com/x.png']) {
      expect(normaliseImageUrl(input)).toBeNull()
    }
  })
})
