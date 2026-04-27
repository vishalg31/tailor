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

const ATS_SCORING_PROMPT = (cvText: string, jdText: string, includeSuggestions: boolean) => `
You are simulating an enterprise ATS (Applicant Tracking System) scoring engine like Workday, Greenhouse, or Lever.

Score the following CV against the job description using ONLY these criteria:

SCORING RUBRIC (total 100 points):

1. Hard Keyword Match (50 points)
   - Exact and semantic matches of technical skills, tools, software, methodologies, certifications, and job titles
   - Partial credit for related terms
   - IGNORE soft skills like "leadership", "communication", "collaborative"

2. Job Scope Alignment (25 points)
   - Seniority level match (Senior PM vs APM vs Director)
   - Functional domain match (B2B, logistics, marketplace, fintech etc.)
   - Team/org scale match (startup vs enterprise)

3. Recency of Relevant Experience (15 points)
   - Matching skills in the most recent 1-2 roles score higher
   - Current role relevance weighted most heavily

4. Qualifications Match (10 points)
   - Years of experience matches stated requirement
   - Education or certifications match if explicitly required

SCORING SCALE:
- 0-50: Weak Match
- 51-70: Moderate Match
- 71-85: Strong Match
- 86-95: Excellent Match
- 96-100: Exceptional Match (reserved for near-perfect alignment)

IMPORTANT RULES:
- Scores can reach 100 for a genuinely exceptional match
- Do not inflate — be calibrated and honest
- Missing a required hard skill should meaningfully drop the score
- Soft skills carry zero weight

CV:
${cvText}

JOB DESCRIPTION:
${jdText}

Return ONLY a valid JSON object, no preamble, no markdown, no backticks:
{
  "totalScore": <number 0-100>,
  "scoreLabel": "<Weak Match | Moderate Match | Strong Match | Excellent Match | Exceptional Match>",
  "breakdown": {
    "hardKeywords": { "score": <number 0-50>, "explanation": "<one line>" },
    "jobScope": { "score": <number 0-25>, "explanation": "<one line>" },
    "recency": { "score": <number 0-15>, "explanation": "<one line>" },
    "qualifications": { "score": <number 0-10>, "explanation": "<one line>" }
  },
  "matchedKeywords": ["<keyword>"],
  "missingKeywords": ["<hard skill keyword only — technical tools, software, methodologies, domain terms, certifications. Exclude all soft skills, personality traits, abstract qualities, and generic descriptors>"]${includeSuggestions ? `,
  "placementSuggestions": [
    { "keyword": "<copy the keyword exactly as it appears in missingKeywords>", "suggestion": "<one sentence under 20 words: where in the CV to naturally work in this keyword>" }
  ]` : ''}
}
`

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) return originDenied()

  try {
    const { cvText, jdText, includeSuggestions = false, devModel } = await req.json()
    const modelToUse = (process.env.NODE_ENV !== 'production' && devModel) ? devModel : MODELS.scoring
    if (!cvText || !jdText) {
      return NextResponse.json({ error: 'Missing cvText or jdText' }, { status: 400 })
    }
    if (cvText.length > MAX_CV_CHARS || jdText.length > MAX_JD_CHARS) {
      return NextResponse.json({ error: 'Input exceeds maximum length' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

    const runScore = (modelName: string) =>
      genAI.getGenerativeModel({ model: modelName }).generateContent(ATS_SCORING_PROMPT(cvText, jdText, includeSuggestions))

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
