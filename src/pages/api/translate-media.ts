import type { APIRoute } from 'astro'
import { transcribeMedia } from '../../lib/transcribe'
import { translateToBurmese } from '../../lib/translate'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return new Response(JSON.stringify({ error: 'Please choose an audio file.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const source = await transcribeMedia(file)
    const translation = await translateToBurmese(source)
    return new Response(JSON.stringify({ translation, source, filename: file.name }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not transcribe this media file.'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
