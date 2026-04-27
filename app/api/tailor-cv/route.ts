import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from '@/lib/models'
import { isAllowedOrigin, originDenied, MAX_JD_CHARS, MAX_CV_CHARS } from '@/lib/apiGuard'
import type { ResumeJSONType } from '@/lib/schema'

export const runtime = 'nodejs'
export const maxDuration = 120

const TAILOR_PROMPT = (resumeJson: ResumeJSONType, jdText: string) => `You are an expert CV tailoring assistant for Senior Product Managers.

Given this parsed CV in JSON format and a job description, return ONLY valid JSON — no markdown, no explanation, no code fences.

Rules:
- Each rewritten bullet must not exceed 200 characters
- Use STAR method (Situation, Task, Action, Result) where applicable
- Include a hard metric in every bullet where one exists in the original
- Include ALL bullets from every role — never drop any. If a bullet needs no changes, copy it exactly as-is
- Rewrite to match keywords from the JD naturally and authentically
- Rewrite the summary to align with the specific role
- Wrap key metrics and critical JD keywords in **double asterisks**: e.g. "Generated **$3MM+** annually" or "Led **A/B experimentation** framework". Bold maximum 2–3 terms per bullet — be selective, not every number

Return this exact JSON shape:
{
  "tailoredExperience": [{ "company": string, "title": string, "startDate": string, "endDate": string, "bullets": string[] }],
  "tailoredSummary": string
}

CV JSON:
${JSON.stringify(resumeJson, null, 2)}

Job Description:
${jdText}`

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) return originDenied()

  let resumeJson: ResumeJSONType
  let jdText: string
  let overrideModel: string | null = null

  try {
    const body = await req.json()
    resumeJson = body.resumeJson
    jdText = body.jdText
    if (process.env.NODE_ENV !== 'production' && body.devModel) {
      overrideModel = body.devModel as string
    }
    if (!resumeJson || !jdText) {
      return new Response(JSON.stringify({ error: 'Missing resumeJson or jdText' }), { status: 400 })
    }
    if (jdText.length > MAX_JD_CHARS) {
      return new Response(JSON.stringify({ error: 'Job description exceeds maximum length' }), { status: 400 })
    }
    if (JSON.stringify(resumeJson).length > MAX_CV_CHARS) {
      return new Response(JSON.stringify({ error: 'CV data exceeds maximum length' }), { status: 400 })
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

  const encoder = new TextEncoder()

  async function tryStream(modelName: string) {
    const model = genAI.getGenerativeModel({ model: modelName })
    const result = await model.generateContentStream(TAILOR_PROMPT(resumeJson, jdText))
    return result
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let result
        const primaryModel = overrideModel ?? MODELS.tailoring
        console.log('[tailor-cv] Trying primary:', primaryModel)
        try {
          result = await tryStream(primaryModel)
          console.log('[tailor-cv] Primary succeeded:', primaryModel)
        } catch (primaryErr) {
          const is503 = String(primaryErr).includes('503')
          if (!is503) throw primaryErr
          console.warn('[tailor-cv] Primary 503, trying fallback:', MODELS.tailoringFallback)
          try {
            result = await tryStream(MODELS.tailoringFallback)
            console.log('[tailor-cv] Fallback succeeded:', MODELS.tailoringFallback)
          } catch (fallbackErr) {
            const fallbackIs503 = String(fallbackErr).includes('503')
            if (!fallbackIs503) throw fallbackErr
            console.warn('[tailor-cv] Fallback 503, trying backup:', MODELS.tailoringBackup)
            result = await tryStream(MODELS.tailoringBackup)
            console.log('[tailor-cv] Backup succeeded:', MODELS.tailoringBackup)
          }
        }

        let fullResponse = ''
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            fullResponse += text
            controller.enqueue(encoder.encode(text))
          }
        }
        console.log('[tailor-cv] Response preview:', fullResponse.slice(0, 300))
        controller.close()
      } catch (err) {
        console.error('[tailor-cv] Gemini error:', err)
        const errStr = String(err)
        const isQuota = errStr.includes('429') || errStr.toLowerCase().includes('quota')
        controller.enqueue(encoder.encode(isQuota ? '__ERROR__:quota_exhausted' : '__ERROR__:unavailable'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
