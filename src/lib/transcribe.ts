import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MAX_SECONDS = 90
const MAX_BYTES = 20 * 1024 * 1024

function run(cmd: string, args: string[]): Promise<{ stdout: Buffer; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (d: Buffer) => chunks.push(d))
    child.stderr.on('data', (d: Buffer) => errChunks.push(d))
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({
        stdout: Buffer.concat(chunks),
        stderr: Buffer.concat(errChunks).toString(),
        code: code ?? 1,
      })
    })
  })
}

async function durationSeconds(input: string): Promise<number> {
  const result = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    input,
  ])
  const value = parseFloat(result.stdout.toString().trim())
  return Number.isFinite(value) ? value : 0
}

async function transcribeWav(wavPath: string): Promise<string> {
  const result = await run('python3', ['-c', PY_TRANSCRIBE, wavPath])
  if (result.code === 2) throw new Error('No speech could be detected in this media file.')
  if (result.code !== 0) {
    const err = result.stderr.trim() || result.stdout.toString().trim()
    throw new Error(err || 'Speech recognition failed.')
  }
  const text = result.stdout.toString().trim()
  if (!text) throw new Error('No speech could be detected in this media file.')
  return text
}

const PY_TRANSCRIBE = `
import sys
try:
    import speech_recognition as sr
except ImportError:
    sys.stderr.write("SpeechRecognition is not installed")
    sys.exit(3)

path = sys.argv[1]
r = sr.Recognizer()
with sr.AudioFile(path) as source:
    audio = r.record(source)
try:
    print(r.recognize_google(audio, language="en-US"))
except sr.UnknownValueError:
    sys.exit(2)
except sr.RequestError as e:
    sys.stderr.write(str(e))
    sys.exit(3)
`

const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac', 'flac', 'wma', 'opus', 'oga'])

export async function transcribeMedia(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error('Audio file is too large. Please use a file under 20 MB.')
  }

  const type = (file.type || '').toLowerCase()
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  if (type.startsWith('video/') || ['mp4', 'mov', 'mkv', 'avi', 'm4v'].includes(ext)) {
    throw new Error('Video files are not supported. Please upload an audio file such as MP3, WAV, or M4A.')
  }
  if (type && !type.startsWith('audio/') && !AUDIO_EXT.has(ext)) {
    throw new Error('Please upload an audio file such as MP3, WAV, M4A, or WEBM.')
  }
  const id = randomUUID()
  const inputPath = join(tmpdir(), `src-${id}.${ext}`)
  const wavPath = join(tmpdir(), `wav-${id}.wav`)

  await writeFile(inputPath, Buffer.from(await file.arrayBuffer()))

  try {
    const seconds = await durationSeconds(inputPath)
    if (seconds > MAX_SECONDS) {
      throw new Error(`Audio is ${Math.round(seconds)}s long. Please use a clip under ${MAX_SECONDS} seconds.`)
    }

    const converted = await run('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-ar',
      '16000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      '-t',
      String(MAX_SECONDS),
      wavPath,
    ])
    if (converted.code !== 0) {
      throw new Error('Could not read this audio file. Try MP3, WAV, M4A, or WEBM.')
    }

    return await transcribeWav(wavPath)
  } finally {
    await unlink(inputPath).catch(() => undefined)
    await unlink(wavPath).catch(() => undefined)
  }
}
