import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from '@/lib/models'

export const runtime = 'nodejs'
export const maxDuration = 30

const SUGGEST_PROMPT = (keyword: string, cvText: string) => `
You are a CV advisor. A candidate's tailored resume is missing this ATS keyword: "${keyword}".

Here is their current tailored CV experience:
${cvText}

In one short sentence (under 20 words), suggest exactly where and how to naturally add "${keyword}" to the CV. Be specific — name the company or role to modify.

Reply with the suggestion sentence only. No JSON, no prefix, no explanation.
`.trim()

export async function POST(req: NextRequest) {
  try {
    const { keyword, cvText } = await req.json()
    if (!keyword || !cvText) {
      return NextResponse.json({ error: 'Missing keyword or cvText' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: MODELS.scoring })

    const result = await model.generateContent(SUGGEST_PROMPT(keyword, cvText))
    const suggestion = result.response.text().trim()

    return NextResponse.json({ suggestion })
  } catch (err) {
    console.error('[suggest-placement] Error:', err)
    return NextResponse.json({ error: 'Suggestion failed' }, { status: 500 })
  }
}
