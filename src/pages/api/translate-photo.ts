import type { APIRoute } from 'astro'

export const prerender = false

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Photo translation has been removed.' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const ALL: APIRoute = POST
