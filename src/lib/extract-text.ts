import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'

const MAX_CHARS = 20000

function clip(text: string): string {
  const cleaned = text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim()
  if (cleaned.length <= MAX_CHARS) return cleaned
  return `${cleaned.slice(0, MAX_CHARS)}\n\n[Text truncated after ${MAX_CHARS} characters]`
}

export async function extractFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || name.endsWith('.text')) {
    return clip(buffer.toString('utf8'))
  }

  if (name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value?.trim()
    if (!text) throw new Error('No readable text found in this Word file.')
    return clip(text)
  }

  if (name.endsWith('.doc')) {
    throw new Error('Legacy .doc files are not supported. Please save as .docx, .txt, or .pdf.')
  }

  if (name.endsWith('.pdf')) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const extracted = await extractText(pdf, { mergePages: true })
    const text = (Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text).trim()
    if (!text) throw new Error('No readable text found in this PDF. It may be a scanned image.')
    return clip(text)
  }

  throw new Error('Unsupported file type. Use .txt, .docx, or .pdf.')
}
