import type { APIRoute } from 'astro'
import { translateToBurmese } from '../../lib/translate'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as { text?: string }
    const text = typeof body.text === 'string' ? body.text : ''
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'Please enter English text to translate.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (text.length > 20000) {
      return new Response(JSON.stringify({ error: 'Text is too long. Please keep it under 20,000 characters.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const translation = await translateToBurmese(text)
    return new Response(JSON.stringify({ translation, source: text }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Translation failed.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
