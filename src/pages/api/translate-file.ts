import type { APIRoute } from 'astro'
import { extractFromFile } from '../../lib/extract-text'
import { translateToBurmese } from '../../lib/translate'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return new Response(JSON.stringify({ error: 'Please choose a .txt, .docx, or .pdf file.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (file.size > 12 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File is too large. Please use a file under 12 MB.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const source = await extractFromFile(file)
    const translation = await translateToBurmese(source)
    return new Response(JSON.stringify({ translation, source, filename: file.name }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not translate this file.'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
