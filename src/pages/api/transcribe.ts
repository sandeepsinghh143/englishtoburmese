import type { APIRoute } from 'astro'

export const prerender = false

export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      error: 'Microphone voice recognition works best in Chrome, Safari, or Edge via Web Speech.',
      text: '',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

export const ALL: APIRoute = POST
