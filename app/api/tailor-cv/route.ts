import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from '@/lib/models'
import { isAllowedOrigin, originDenied, MAX_JD_CHARS, MAX_CV_CHARS } from '@/lib/apiGuard'
import { logTokens } from '@/lib/logTokens'
import type { ResumeJSONType } from '@/lib/schema'

export const runtime = 'nodejs'
export const maxDuration = 120

const TAILOR_PROMPT = (resumeJson: ResumeJSONType, jdText: string) => `You are an expert CV tailoring engine helping professionals apply to competitive roles.

You will be given:
1. A structured CV in JSON format (ResumeJSON)
2. A raw job description

Your task is to rewrite the CV experience and summary to maximise alignment with this specific role.

STEP 1 — ANALYSE THE JD FIRST:
Before rewriting anything, identify from the JD:
- The 5–8 most important hard skills and keywords (tools, methodologies, domain terms — ignore soft skills)
- The seniority level and scope expected
- The primary domain (B2B, marketplace, fintech, etc.)
- Any explicitly required qualifications or experience

STEP 2 — REWRITE RULES:
- Rewrite bullets to naturally incorporate the identified keywords and align scope/impact with what the JD expects
- Every bullet must follow STAR method where applicable (Situation/Task → Action → Result)
- Hard metric required in every bullet — %, $, time, team size, revenue impact. If original has no metric, add a realistic placeholder in [brackets] for the user to fill in
- Max 200 characters per bullet — never exceed this
- Wrap the 2–3 most important keywords or metrics per bullet in **double asterisks** for emphasis
- Never drop a bullet — if a bullet cannot be improved for this role, copy it unchanged
- Rewrite the summary to directly address the role's primary requirements in 3–4 sentences
- Do not fabricate experience, companies, titles, or dates

STEP 3 — OUTPUT:
Return ONLY valid JSON, no markdown, no explanation:
{
  "tailoredExperience": [{
    "company": string,
    "title": string,
    "startDate": string,
    "endDate": string,
    "bullets": string[]
  }],
  "tailoredSummary": string
}

RESUME JSON:
${JSON.stringify(resumeJson, null, 2)}

JOB DESCRIPTION:
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
        let actualModel = primaryModel
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
            actualModel = MODELS.tailoringFallback
            console.log('[tailor-cv] Fallback succeeded:', MODELS.tailoringFallback)
          } catch (fallbackErr) {
            const fallbackIs503 = String(fallbackErr).includes('503')
            if (!fallbackIs503) throw fallbackErr
            console.warn('[tailor-cv] Fallback 503, trying backup:', MODELS.tailoringBackup)
            result = await tryStream(MODELS.tailoringBackup)
            actualModel = MODELS.tailoringBackup
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
        const usage = (await result.response).usageMetadata
        logTokens({
          route: 'tailor-cv',
          model: actualModel,
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        })
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
