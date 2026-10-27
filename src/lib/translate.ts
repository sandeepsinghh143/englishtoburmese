import { toUnicode } from './zg2uni'

const CHUNK = 1200
const cache = new Map<string, string>()

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

function splitChunks(text: string, max = CHUNK): string[] {
  const chunks: string[] = []
  let remaining = text.trim()
  while (remaining.length > max) {
    const window = remaining.slice(0, max)
    const cutAt = Math.max(window.lastIndexOf('\n'), window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '), window.lastIndexOf(' '))
    const cut = cutAt > max * 0.4 ? cutAt + 1 : max
    chunks.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

function parseGoogle(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'sentences' in payload) {
    const sentences = (payload as { sentences?: Array<{ trans?: string }> }).sentences
    const out = sentences?.map((s) => s.trans || '').join('') || ''
    if (out.trim()) return out
  }
  if (Array.isArray(payload) && Array.isArray(payload[0])) {
    const out = (payload[0] as unknown[])
      .map((row) => (Array.isArray(row) && typeof row[0] === 'string' ? row[0] : ''))
      .join('')
    if (out.trim()) return out
  }
  throw new Error('Could not read translation response')
}

async function googlePost(text: string): Promise<string> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=my&hl=en&dt=t&dt=bd&dj=1&ie=UTF-8&oe=UTF-8'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': UA,
    },
    body: new URLSearchParams({ q: text }).toString(),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Google ${res.status}`)
  return parseGoogle(await res.json())
}

async function googleGet(text: string): Promise<string> {
  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'en')
  url.searchParams.set('tl', 'my')
  url.searchParams.set('dt', 't')
  url.searchParams.set('dj', '1')
  url.searchParams.set('ie', 'UTF-8')
  url.searchParams.set('oe', 'UTF-8')
  url.searchParams.set('q', text)
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Google ${res.status}`)
  return parseGoogle(await res.json())
}

async function myMemory(text: string): Promise<string> {
  const url = new URL('https://api.mymemory.translated.net/get')
  url.searchParams.set('q', text.slice(0, 450))
  url.searchParams.set('langpair', 'en|my')
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`MyMemory ${res.status}`)
  const data = (await res.json()) as { responseData?: { translatedText?: string } }
  const out = data.responseData?.translatedText?.trim()
  if (!out) throw new Error('Empty MyMemory response')
  if (/MYMEMORY WARNING/i.test(out)) throw new Error('MyMemory quota')
  return out
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
  const attempts = [googlePost, googleGet, myMemory]
  let lastError: unknown
  for (const attempt of attempts) {
    try {
      const raw = await attempt(text)
      const out = tidy(raw)
      if (out && hasMyanmar(out)) return out
      lastError = new Error('Translation was not Burmese')
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Translation failed')
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
