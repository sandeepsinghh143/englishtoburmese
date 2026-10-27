import { toUnicode } from './zg2uni'

const CHUNK = 1200
const cache = new Map<string, string>()

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'

function splitChunks(text: string, max = CHUNK): string[] {
  const chunks: string[] = []
  let remaining = text.trim()
  while (remaining.length > max) {
    const window = remaining.slice(0, max)
    const cutAt = Math.max(
      window.lastIndexOf('\n'),
      window.lastIndexOf('. '),
      window.lastIndexOf('? '),
      window.lastIndexOf('! '),
      window.lastIndexOf(' '),
    )
    const cut = cutAt > max * 0.4 ? cutAt + 1 : max
    chunks.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

function parseResponse(payload: unknown): string {
  if (Array.isArray(payload)) {
    // dict-chrome-ex returns ["translated text"]
    const strings = payload.filter((item): item is string => typeof item === 'string')
    if (strings.length > 0) {
      return strings.join('')
    }
    // gtx returns [[["translated", "source", null, null]]]
    if (Array.isArray(payload[0])) {
      const out = (payload[0] as unknown[])
        .map((row) => (Array.isArray(row) && typeof row[0] === 'string' ? row[0] : ''))
        .join('')
      if (out.trim()) return out
    }
  }
  if (payload && typeof payload === 'object' && 'sentences' in payload) {
    const sentences = (payload as { sentences?: Array<{ trans?: string }> }).sentences
    const out = sentences?.map((s) => s.trans || '').join('') || ''
    if (out.trim()) return out
  }
  throw new Error('Could not parse translation response')
}

async function googleDictPost(host: string, text: string): Promise<string> {
  const url = `https://${host}/translate_a/t?client=dict-chrome-ex&sl=en&tl=my`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': UA,
    },
    body: new URLSearchParams({ q: text }).toString(),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Google ${host} ${res.status}`)
  return parseResponse(await res.json())
}

async function googleDictGet(host: string, text: string): Promise<string> {
  const url = new URL(`https://${host}/translate_a/t`)
  url.searchParams.set('client', 'dict-chrome-ex')
  url.searchParams.set('sl', 'en')
  url.searchParams.set('tl', 'my')
  url.searchParams.set('q', text)
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Google ${host} GET ${res.status}`)
  return parseResponse(await res.json())
}

async function googleGtx(text: string): Promise<string> {
  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'en')
  url.searchParams.set('tl', 'my')
  url.searchParams.set('dt', 't')
  url.searchParams.set('ie', 'UTF-8')
  url.searchParams.set('oe', 'UTF-8')
  url.searchParams.set('q', text)
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Google GTX ${res.status}`)
  return parseResponse(await res.json())
}

async function myMemoryFallback(text: string): Promise<string> {
  try {
    const url = new URL('https://api.mymemory.translated.net/get')
    url.searchParams.set('q', text.slice(0, 450))
    url.searchParams.set('langpair', 'en|my')
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return ''
    const data = (await res.json()) as { responseData?: { translatedText?: string } }
    const out = data.responseData?.translatedText?.trim() || ''
    if (/MYMEMORY WARNING/i.test(out)) return ''
    return out
  } catch {
    return ''
  }
}

function tidy(text: string): string {
  return toUnicode(text)
    .replace(/\s+([၊။!?.,])/g, '$1')
    .replace(/([၊။])(?=\S)/g, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function hasMyanmar(text: string): boolean {
  return /[\u1000-\u109F]/.test(text)
}

async function translateChunk(text: string): Promise<string> {
  const attempts: Array<() => Promise<string>> = [
    () => googleDictPost('clients5.google.com', text),
    () => googleDictPost('clients1.google.com', text),
    () => googleDictPost('translate.googleapis.com', text),
    () => googleDictGet('clients5.google.com', text),
    () => googleDictGet('clients1.google.com', text),
    () => googleGtx(text),
    () => myMemoryFallback(text),
  ]

  for (const attempt of attempts) {
    try {
      const raw = await attempt()
      const out = tidy(raw)
      if (out && hasMyanmar(out)) return out
    } catch {
      // Continue to next attempt
    }
  }

  throw new Error('Translation service is temporarily busy. Please try again.')
}

export async function translateToBurmese(text: string): Promise<string> {
  const trimmed = text.replace(/\r\n/g, '\n').trim()
  if (!trimmed) return ''
  const hit = cache.get(trimmed)
  if (hit) return hit

  const blocks = trimmed.split(/\n{2,}/)
  const out: string[] = []
  for (const block of blocks) {
    const line = block.trim()
    if (!line) {
      out.push('')
      continue
    }
    const parts: string[] = []
    for (const chunk of splitChunks(line)) {
      parts.push(await translateChunk(chunk))
    }
    out.push(parts.join(' '))
  }

  const result = tidy(out.join('\n\n'))
  if (!result) throw new Error('No Burmese translation was returned. Please try again.')
  if (cache.size > 300) cache.clear()
  cache.set(trimmed, result)
  return result
}
