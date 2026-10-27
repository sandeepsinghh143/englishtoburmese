import type { APIRoute } from 'astro'
import { transcribeMedia } from '../../lib/transcribe'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return new Response(JSON.stringify({ error: 'No speech was recorded.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const text = await transcribeMedia(file)
    return new Response(JSON.stringify({ text }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not transcribe speech.'
    if (/no speech/i.test(message)) {
      return new Response(JSON.stringify({ text: '' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
