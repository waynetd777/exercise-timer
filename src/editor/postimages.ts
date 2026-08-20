/**
 * Accepts either form of a postimages link and returns a direct image URL.
 *
 * Verified against the real service: the FILENAME SEGMENT of an
 * `i.postimg.cc/<id>/<name>.<ext>` URL is ignored — any name or extension
 * returns the image, and only a bare trailing slash 404s. That is what makes it
 * possible to turn a share link into a direct link without fetching anything;
 * the `postimg.cc` page itself sends no CORS headers, so it cannot be read from
 * the browser.
 *
 * Caveat worth knowing: a share id may map to a resized variant, since one page
 * exposed three ids for the same image. Pasting the direct link avoids that.
 */
const DIRECT = /^https?:\/\/i\.postimg\.cc\/[A-Za-z0-9]+\/.+$/i
const SHARE = /^https?:\/\/(?:www\.)?postimg\.cc\/([A-Za-z0-9]+)\/?$/i
const BARE_ID = /^[A-Za-z0-9]{6,}$/

export function normaliseImageUrl(input: string): string | null {
  const url = input.trim()
  if (!url) return null

  if (DIRECT.test(url)) return url.replace(/^http:/, 'https:')

  const share = SHARE.exec(url)
  if (share) return `https://i.postimg.cc/${share[1]}/img.png`

  // A pasted id on its own is unambiguous enough to accept.
  if (BARE_ID.test(url)) return `https://i.postimg.cc/${url}/img.png`

  // Any other https image URL is passed through — nothing here is
  // postimages-specific except the share-link shortcut.
  if (/^https:\/\/\S+$/i.test(url)) return url

  return null
}
