import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const errChunks: Buffer[] = []
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    child.stderr.on('data', (d: Buffer) => errChunks.push(d))
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stderr: Buffer.concat(errChunks).toString() })
    })
  })
}

async function fetchChunk(text: string): Promise<Buffer> {
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
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 200) throw new Error('Could not generate Burmese audio.')
  return buf
}

export async function speakBurmese(raw: string): Promise<Buffer> {
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
  if (!text) throw new Error('No Burmese text to read.')

  const chunks = splitChunks(text)
  const id = randomUUID()
  const dir = tmpdir()
  const parts: string[] = []
  const listPath = join(dir, `tts-${id}.txt`)
  const outPath = join(dir, `tts-${id}.mp3`)

  try {
    for (let i = 0; i < chunks.length; i++) {
      const audio = await fetchChunk(chunks[i])
      const partPath = join(dir, `tts-${id}-${i}.mp3`)
      await writeFile(partPath, audio)
      parts.push(partPath)
    }

    if (parts.length === 1) {
      return await readFile(parts[0])
    }

    const list = parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
    await writeFile(listPath, list)
    const joined = await run('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      outPath,
    ])
    if (joined.code !== 0) {
      const encoded = await run('ffmpeg', [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-ar',
        '24000',
        '-ac',
        '1',
        '-c:a',
        'libmp3lame',
        '-q:a',
        '4',
        outPath,
      ])
      if (encoded.code !== 0) throw new Error('Could not build Burmese audio.')
    }
    return await readFile(outPath)
  } finally {
    await Promise.all([unlink(listPath).catch(() => undefined), unlink(outPath).catch(() => undefined), ...parts.map((p) => unlink(p).catch(() => undefined))])
  }
}
