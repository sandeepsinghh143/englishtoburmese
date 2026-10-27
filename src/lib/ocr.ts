import { createWorker } from 'tesseract.js'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif', 'image/tiff'])

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, { logger: () => undefined }).catch((error) => {
      workerPromise = null
      throw error
    })
  }
  return workerPromise
}

export async function extractTextFromImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error('Photo is too large. Please use an image under 10 MB.')
  }
  const type = (file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  const okType = ALLOWED.has(type) || /\.(jpe?g|png|webp|bmp|gif|tiff?)$/.test(name)
  if (!okType) {
    throw new Error('Unsupported photo type. Use JPG, PNG, WEBP, or BMP.')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const worker = await getWorker()
  const result = await worker.recognize(buffer)
  const text = (result.data.text || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!text || text.replace(/\W/g, '').length < 2) {
    throw new Error('No readable English text was found in this photo. Try a clearer shot.')
  }
  return text
}
