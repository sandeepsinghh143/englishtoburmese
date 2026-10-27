const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const CHUNK = 180
const MAX_CHARS = 4000

function splitChunks(text: string, max = CHUNK): string[] {
  const chunks: string[] = []
  let remaining = text.trim()
  while (remaining.length > max) {
    const window = remaining.slice(0, max)
    const cutAt = Math.max(
      window.lastIndexOf('။'),
      window.lastIndexOf('၊'),
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
  return chunks.filter(Boolean)
}

async function fetchChunk(text: string): Promise<Uint8Array> {
  const url = new URL('https://translate.google.com/translate_tts')
  url.searchParams.set('ie', 'UTF-8')
  url.searchParams.set('q', text)
  url.searchParams.set('tl', 'my')
  url.searchParams.set('client', 'tw-ob')
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Referer: 'https://translate.google.com/',
      Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error('Could not generate Burmese audio.')
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.length < 200) throw new Error('Could not generate Burmese audio.')
  return buf
}

export async function speakBurmese(raw: string): Promise<Uint8Array> {
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
  if (!text) throw new Error('No Burmese text to read.')

  const chunks = splitChunks(text)
  const parts: Uint8Array[] = []
  for (const chunk of chunks) {
    parts.push(await fetchChunk(chunk))
  }

  if (parts.length === 1) {
    return parts[0]
  }

  const totalLength = parts.reduce((acc, curr) => acc + curr.length, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }
  return merged
}
