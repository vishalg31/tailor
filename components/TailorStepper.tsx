'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { extractJSON, resumeToText } from '@/lib/utils'
import { TailoredJSON } from '@/lib/schema'
import type { TailoredJSONType, ATSScoreType, ResumeJSONType } from '@/lib/schema'

type StepState = 'pending' | 'active' | 'done' | 'error'

interface Props {
  resumeJson: ResumeJSONType
  jdText: string
  onComplete: (tailoredJson: TailoredJSONType, originalScore: ATSScoreType | null, tailoredScore: ATSScoreType | null) => void
  onError: (msg: string) => void
}

export function TailorStepper({ resumeJson, jdText, onComplete, onError }: Props) {
  const [steps, setSteps] = useState([
    { label: 'Reading your experience...', state: 'active' as StepState },
    { label: 'Tailoring bullets for your CV...', state: 'pending' as StepState },
    { label: 'Calculating your ATS score...', state: 'pending' as StepState },
  ])
  const [streamedChars, setStreamedChars] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [canRetry, setCanRetry] = useState(false)
  const [scoringQuotaReached, setScoringQuotaReached] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const setStepState = (index: number, state: StepState) => {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, state } : s)))
  }

  useEffect(() => {
    run()
    return () => abortRef.current?.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    setErrorMsg(null)
    setCanRetry(false)
    setSteps([
      { label: 'Reading your experience...', state: 'active' },
      { label: 'Tailoring bullets for your CV...', state: 'pending' },
      { label: 'Calculating your ATS score...', state: 'pending' },
    ])

    const abort = new AbortController()
    abortRef.current = abort

    try {
      setStepState(0, 'active')
      await delay(500)
      setStepState(0, 'done')
      setStepState(1, 'active')

      // Step 1 — tailor
      const devModels = JSON.parse(localStorage.getItem('tailor_dev_models') || '{}')
      const res = await fetch('/api/tailor-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeJson, jdText, devModel: devModels.tailoring }),
        signal: abort.signal,
      })

      if (!res.ok) throw new Error('Tailoring request failed. Please try again.')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullText += chunk
        setStreamedChars(fullText.length)
        if (fullText.includes('__ERROR__:')) {
          const isQuota = fullText.includes('quota_exhausted')
          throw new Error(
            isQuota
              ? 'Tailoring quota reached for today — free tier limit hit. Come back tomorrow, your session is saved.'
              : 'Our AI service is temporarily unavailable. Please try again in a few minutes.'
          )
        }
      }

      setStepState(1, 'done')
      setStepState(2, 'active')

      const jsonText = extractJSON(fullText)
      let parsed
      try {
        parsed = JSON.parse(jsonText)
      } catch {
        throw new Error('Tailoring timed out. Your CV and job description are saved — hit Try Again to retry.')
      }

      const validated = TailoredJSON.safeParse(parsed)
      if (!validated.success) {
        console.error('[TailorStepper] Zod failed:', validated.error.issues)
        throw new Error('Tailoring timed out. Your CV and job description are saved — hit Try Again to retry.')
      }

      const tailoredJson = validated.data

      // Step 2 — score original then tailored (sequential to avoid burst 429s)
      const originalCvText = resumeToText(resumeJson)
      const tailoredCvText = resumeToText(
        resumeJson,
        tailoredJson.tailoredExperience,
        tailoredJson.tailoredSummary
      )

      // Returns null if Gemini daily quota is exhausted — we degrade gracefully rather than blocking results
      async function fetchScore(cvText: string, includeSuggestions = false): Promise<ATSScoreType | null> {
        const res = await fetch('/api/score-cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cvText, jdText, includeSuggestions, devModel: devModels.scoring }),
          signal: abort.signal,
        })
        if (res.status === 429) return null
        if (!res.ok) throw new Error('Scoring failed. Your tailored CV is ready — hit Try Again to retry.')
        const { score } = await res.json()
        return score
      }

      const originalScore = await fetchScore(originalCvText)

      if (originalScore === null) {
        // Daily quota hit — show notice but don't block the tailored CV
        setScoringQuotaReached(true)
        setStepState(2, 'done')
        await delay(600)
        onComplete(tailoredJson, null, null)
        return
      }

      await delay(1500)
      const tailoredScore = await fetchScore(tailoredCvText, true)

      setStepState(2, 'done')
      await delay(300)
      onComplete(tailoredJson, originalScore, tailoredScore)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Tailoring timed out. Your CV and job description are saved — hit Try Again to retry.'
      setErrorMsg(msg)
      setSteps(prev => prev.map(s => s.state === 'active' ? { ...s, state: 'error' } : s))
      setCanRetry(true)
      onError(msg)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 16px' }}>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 32, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Tailoring CV
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {steps.map((step, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <StepIcon state={step.state} />
            <span style={{
              fontSize: 14,
              color: step.state === 'active' ? 'var(--text-primary)'
                : step.state === 'done' ? 'var(--text-secondary)'
                : step.state === 'error' ? 'var(--error)'
                : 'var(--text-tertiary)',
              transition: 'color 0.3s',
            }}>
              {step.label}
            </span>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {steps.some(s => s.state === 'active') && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            <TailoringAnimation />
            {streamedChars > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 4 }}
                className="streaming-cursor">
                Receiving tailored content
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scoringQuotaReached && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ fontSize: 12, color: 'var(--warning)', marginTop: 20, lineHeight: 1.5 }}>
            ATS scoring unavailable today — daily limit reached. Your tailored CV is ready below. Come back tomorrow for scores.
          </motion.p>
        )}
        {errorMsg && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: 28, padding: '12px 16px', background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 6 }}>
            <p style={{ fontSize: 13, color: 'var(--error)', margin: '0 0 12px' }}>{errorMsg}</p>
            {canRetry && (
              <button onClick={() => run()}
                style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, minHeight: 44 }}>
                Try Again →
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') return (
    <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill="var(--accent)" opacity="0.15" />
      <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  )
  if (state === 'active') return (
    <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
      style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent)', flexShrink: 0 }} />
  )
  if (state === 'error') return (
    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--error)', flexShrink: 0 }} />
  )
  return <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border-strong)', flexShrink: 0 }} />
}

/* ── Tailor flow animation ────────────────────────────────── */
function TailoringAnimation() {
  const letters = ['T', 'A', 'I', 'L', 'O', 'R']

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      height: 72,
      marginTop: 28,
      overflow: 'visible',
    }}>
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          animate={{
            x:       [-100, 0, 0, 100],
            opacity: [0, 1, 1, 0],
            scale:   [0.85, 1, 1, 0.85],
          }}
          transition={{
            duration:    2.8,
            delay:       i * 0.09,
            repeat:      Infinity,
            repeatDelay: 0.5,
            times:       [0, 0.28, 0.72, 1],
            ease:        ['easeOut', 'linear', 'easeIn'],
          }}
          style={{
            fontSize:     40,
            fontWeight:   700,
            color:        'var(--accent)',
            fontFamily:   'var(--font-dm-serif, Georgia, serif)',
            display:    'inline-block',
            lineHeight: 1,
          }}
        >
          {letter}
        </motion.span>
      ))}
    </div>
  )
}
