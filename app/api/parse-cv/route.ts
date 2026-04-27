import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ResumeJSON } from '@/lib/schema'
import { MODELS } from '@/lib/models'
import { extractJSON } from '@/lib/utils'
import { isAllowedOrigin, originDenied } from '@/lib/apiGuard'

export const runtime = 'nodejs'
export const maxDuration = 60

const PARSE_PROMPT = (text: string) => `You are a CV parser. Extract information from this CV text and return ONLY valid JSON — no markdown, no explanation, no code fences.

Return this exact JSON shape:
{
  "name": string,
  "email": string,
  "phone": string or omit if missing,
  "location": string or omit if missing,
  "linkedin": string or omit if missing,
  "summary": string or omit if missing,
  "experience": [{ "company": string, "title": string, "startDate": string, "endDate": string, "bullets": string[] }],
  "education": [{ "institution": string, "degree": string, "year": string }],
  "skills": string[],
  "certifications": string[] or omit if none
}

CV Text:
${text}`

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) return originDenied()

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 3 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 3MB limit' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    let rawText = ''

    if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
      try {
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
        const result = await pdfParse(buffer)
        rawText = result.text
      } catch {
        return NextResponse.json(
          { error: "We couldn't extract text from this PDF — it may be a scanned image. Try a text-based PDF or DOCX instead." },
          { status: 422 }
        )
      }
    } else if (
      file.name.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        rawText = result.value
      } catch {
        return NextResponse.json(
          { error: 'Something went wrong reading your DOCX. Please try uploading again.' },
          { status: 422 }
        )
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF or DOCX.' }, { status: 400 })
    }

    if (!rawText || rawText.trim().length < 100) {
      return NextResponse.json(
        { error: "We couldn't extract text from this PDF — it may be a scanned image. Try a text-based PDF or DOCX instead." },
        { status: 422 }
      )
    }

    const devModel = process.env.NODE_ENV !== 'production' ? formData.get('devModel') as string | null : null
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const primaryModelName = devModel || MODELS.parsing
    console.log('[parse-cv] Trying primary:', primaryModelName)

    let geminiResult
    try {
      geminiResult = await genAI.getGenerativeModel({ model: primaryModelName }).generateContent(PARSE_PROMPT(rawText))
      console.log('[parse-cv] Primary succeeded:', primaryModelName)
    } catch (err) {
      console.warn('[parse-cv] Primary failed, trying fallback:', MODELS.parsingFallback, err)
      try {
        geminiResult = await genAI.getGenerativeModel({ model: MODELS.parsingFallback }).generateContent(PARSE_PROMPT(rawText))
        console.log('[parse-cv] Fallback succeeded:', MODELS.parsingFallback)
      } catch (fallbackErr) {
        console.warn('[parse-cv] Fallback failed, trying backup:', MODELS.parsingBackup, fallbackErr)
        try {
          geminiResult = await genAI.getGenerativeModel({ model: MODELS.parsingBackup }).generateContent(PARSE_PROMPT(rawText))
          console.log('[parse-cv] Backup succeeded:', MODELS.parsingBackup)
        } catch (backupErr) {
          console.error('[parse-cv] All models failed:', backupErr)
          const is503 = String(backupErr).includes('503') || String(backupErr).includes('high demand')
          return NextResponse.json(
            {
              error: is503
                ? 'Our AI service is temporarily unavailable. Please try again in a few minutes.'
                : 'Something went wrong while reading your CV. Please try uploading again. If the problem persists, try a DOCX version.',
            },
            { status: 502 }
          )
        }
      }
    }

    const responseText = geminiResult.response.text()
    const jsonText = extractJSON(responseText)

    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json(
        { error: 'Something went wrong while reading your CV. Please try uploading again. If the problem persists, try a DOCX version.' },
        { status: 422 }
      )
    }

    const validated = ResumeJSON.safeParse(parsed)
    if (!validated.success) {
      console.error('[parse-cv] Zod validation failed:', validated.error.issues.map(i => i.message).join(', '))
      return NextResponse.json(
        { error: 'Something went wrong while reading your CV. Please try uploading again. If the problem persists, try a DOCX version.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ resumeJson: validated.data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong while reading your CV. Please try uploading again.' },
      { status: 500 }
    )
  }
}
