import { NextRequest } from 'next/server'

// Max input sizes — prevents prompt-stuffing / token abuse
export const MAX_JD_CHARS = 30_000   // ~5 000 words
export const MAX_CV_CHARS = 50_000   // generous CV text limit

function buildAllowedOrigins(): string[] {
  const origins: string[] = []

  // Custom domain (set in Vercel env vars once custom domain is live)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    origins.push(process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''))
  }

  // Vercel's auto-set stable project URL (e.g. tailor-xyz.vercel.app) — no config needed
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  }

  // Fallback when neither env var is set
  if (origins.length === 0) {
    origins.push('https://tailor.vishalbuilds.com')
  }

  return origins
}

export function isAllowedOrigin(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? ''
  return buildAllowedOrigins().some(allowed => origin.startsWith(allowed))
}

export function originDenied() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}
