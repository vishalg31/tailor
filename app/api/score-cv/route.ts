import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from '@/lib/models'
import { ATSScore } from '@/lib/schema'
import { extractJSON } from '@/lib/utils'
import { isAllowedOrigin, originDenied, MAX_JD_CHARS, MAX_CV_CHARS } from '@/lib/apiGuard'

export const runtime = 'nodejs'
export const maxDuration = 90

// Returns retry delay in ms, or null if this is a daily quota error (not worth retrying)
function parseRetry(err: unknown): number | null {
  const details = (err as { errorDetails?: { retryDelay?: string }[] } | null)?.errorDetails
  if (Array.isArray(details)) {
    for (const d of details) {
      if (typeof d?.retryDelay === 'string') {
        const secs = parseFloat(d.retryDelay)
        if (!isNaN(secs)) {
          // Daily quota exhaustion has retryDelay in the thousands of seconds — don't retry
          if (secs > 60) return null
          // Honor the actual delay up to 25s; beyond that it's not worth blocking the request
          if (secs > 25) return null
          return secs * 1000
        }
      }
    }
  }
  return 4000 // default short wait for unknown 429s
}

const ATS_SCORING_PROMPT = (cvText: string, jdText: string) => `You are simulating an enterprise ATS (Applicant Tracking System) scoring engine like Workday, Greenhouse, or Lever.

IMPORTANT CONTEXT:
- You are scoring a CV that has already been tailored for this specific JD. Be honest and calibrated — do not inflate scores because the CV was AI-tailored.
- A score above 85 should only be awarded if the CV genuinely covers the majority of hard requirements in the JD.
- Scores can reach 100 for exceptional alignment but this is rare.

SCORING RUBRIC (100 points total):

1. Hard Keyword Match (50 points)
   - Exact and semantic matches of technical skills, tools, software, methodologies, certifications, job titles
   - Partial credit for related terms
   - IGNORE all soft skills — "leadership", "communication", "collaborative" carry zero weight

2. Job Scope Alignment (25 points)
   - Seniority level match (APM vs Senior PM vs Director)
   - Functional domain match (B2B, fintech, marketplace etc.)
   - Org scale match (startup vs growth vs enterprise)

3. Recency of Relevant Experience (15 points)
   - Matching skills in most recent 1–2 roles score highest
   - Same skills in roles older than 5 years score minimal points

4. Qualifications Match (10 points)
   - Years of experience vs stated requirement
   - Education or certifications if explicitly required in JD

SCORE LABELS:
0–50: Weak Match
51–70: Moderate Match
71–85: Strong Match
86–95: Excellent Match
96–100: Exceptional Match

RULES:
- Be calibrated — missing a required hard skill must drop the score
- Do not reward keyword density over genuine relevance
- Soft skills carry zero weight in this system

Return ONLY valid JSON, no markdown, no preamble:
{
  "totalScore": number,
  "scoreLabel": string,
  "breakdown": {
    "hardKeywords": { "score": number, "explanation": string },
    "jobScope": { "score": number, "explanation": string },
    "recency": { "score": number, "explanation": string },
    "qualifications": { "score": number, "explanation": string }
  },
  "matchedKeywords": string[],
  "missingKeywords": string[],
  "placementSuggestions": [{ "keyword": string, "suggestion": string }]
}

CV:
${cvText}

JOB DESCRIPTION:
${jdText}`

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) return originDenied()

  try {
    const { cvText, jdText, devModel } = await req.json()
    const modelToUse = (process.env.NODE_ENV !== 'production' && devModel) ? devModel : MODELS.scoring
    if (!cvText || !jdText) {
      return NextResponse.json({ error: 'Missing cvText or jdText' }, { status: 400 })
    }
    if (cvText.length > MAX_CV_CHARS || jdText.length > MAX_JD_CHARS) {
      return NextResponse.json({ error: 'Input exceeds maximum length' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

    const runScore = (modelName: string) =>
      genAI.getGenerativeModel({ model: modelName }).generateContent(ATS_SCORING_PROMPT(cvText, jdText))

    console.log('[score-cv] Trying primary:', modelToUse)
    let result
    try {
      result = await runScore(modelToUse)
      console.log('[score-cv] Primary succeeded:', modelToUse)
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 429) {
        const wait = parseRetry(err)
        if (wait === null) {
          console.error('[score-cv] Daily quota exhausted — not retrying')
          return NextResponse.json({ error: 'AI scoring quota reached for today. Try again tomorrow.' }, { status: 429 })
        }
        console.log(`[score-cv] 429 RPM limit — retrying after ${wait}ms`)
        await new Promise(r => setTimeout(r, wait))
        try {
          result = await runScore(modelToUse)
        } catch {
          return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
        }
      } else if (status === 503) {
        console.warn('[score-cv] Primary 503, trying fallback:', MODELS.scoringFallback)
        try {
          result = await runScore(MODELS.scoringFallback)
          console.log('[score-cv] Fallback succeeded:', MODELS.scoringFallback)
        } catch (fallbackErr) {
          console.warn('[score-cv] Fallback 503, trying backup:', MODELS.scoringBackup)
          try {
            result = await runScore(MODELS.scoringBackup)
            console.log('[score-cv] Backup succeeded:', MODELS.scoringBackup)
          } catch {
            console.error('[score-cv] All models failed — degrading gracefully')
            return NextResponse.json({ error: 'Scoring unavailable — model overloaded.' }, { status: 429 })
          }
        }
      } else {
        throw err
      }
    }

    const raw = result.response.text()

    // Strip any stray backticks or markdown fences before parsing
    const jsonText = extractJSON(raw)

    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      console.error('[score-cv] JSON parse failed, raw:', raw.slice(0, 300))
      return NextResponse.json({ error: 'Score parsing failed' }, { status: 422 })
    }

    const validated = ATSScore.safeParse(parsed)
    if (!validated.success) {
      console.error('[score-cv] Zod validation failed:', validated.error.issues)
      return NextResponse.json({ error: 'Score parsing failed' }, { status: 422 })
    }

    return NextResponse.json({ score: validated.data })
  } catch (err) {
    console.error('[score-cv] Error:', err)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
