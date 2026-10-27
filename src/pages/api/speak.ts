import type { APIRoute } from 'astro'
import { speakBurmese } from '../../lib/speak'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const text = typeof body?.text === 'string' ? body.text : ''
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'No Burmese text to read.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const audio = await speakBurmese(text)
    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not play Burmese audio.'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
