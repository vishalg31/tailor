import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageSize=50`,
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch models from Google API' }, { status: res.status })
  }

  const data = await res.json()

  const models = (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent')
    )
    .map((m: {
      name: string
      displayName: string
      inputTokenLimit: number
      outputTokenLimit: number
      supportedGenerationMethods: string[]
    }) => ({
      id: m.name.replace('models/', ''),
      displayName: m.displayName,
      inputTokenLimit: m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
      streaming: m.supportedGenerationMethods.includes('streamGenerateContent'),
    }))

  return NextResponse.json({ models })
}
