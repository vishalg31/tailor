'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ResumeJSONType } from '@/lib/schema'

type StepState = 'pending' | 'active' | 'done' | 'error'

interface Step {
  label: string
  state: StepState
}

interface Props {
  file: File
  onComplete: (resumeJson: ResumeJSONType, cvHash: string) => void
  onError: (msg: string) => void
  onBack: () => void
}

export function ParseStepper({ file, onComplete, onError, onBack }: Props) {
  const [steps, setSteps] = useState<Step[]>([
    { label: 'Extracting text from your CV...', state: 'active' },
    { label: 'Mapping your experience...', state: 'pending' },
    { label: 'Validating structure...', state: 'pending' },
  ])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const setStepState = (index: number, state: StepState) => {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, state } : s)))
  }

  useEffect(() => {
    async function run() {
      try {
        // Step 1 — text extraction via API
        setStepState(0, 'active')
        const formData = new FormData()
        formData.append('file', file)
        const devModel = JSON.parse(localStorage.getItem('tailor_dev_models') || '{}').parsing
        if (devModel) formData.append('devModel', devModel)

        const res = await fetch('/api/parse-cv', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Parsing failed')
        }

        setStepState(0, 'done')

        // Step 2 — Gemini mapping (already happened server-side, animate UI)
        setStepState(1, 'active')
        await new Promise(r => setTimeout(r, 600))
        setStepState(1, 'done')

        // Step 3 — Zod validation (already happened server-side, animate UI)
        setStepState(2, 'active')
        await new Promise(r => setTimeout(r, 400))
        setStepState(2, 'done')

        // Hash parsed content so two different files with same name/size don't collide
        const { hashString } = await import('@/lib/utils')
        const cvHash = hashString(JSON.stringify(data.resumeJson))

        await new Promise(r => setTimeout(r, 200))
        onComplete(data.resumeJson, cvHash)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong while reading your CV. Please try uploading again.'
        setErrorMsg(msg)
        setSteps(prev => prev.map(s => s.state === 'active' ? { ...s, state: 'error' } : s))
        onError(msg)
      }
    }
    run()
  }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 16px' }}>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 32, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Analysing CV
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <StepIcon state={step.state} />
            <span
              style={{
                fontSize: 14,
                color: step.state === 'active' ? 'var(--text-primary)'
                  : step.state === 'done' ? 'var(--text-secondary)'
                  : step.state === 'error' ? 'var(--error)'
                  : 'var(--text-tertiary)',
                transition: 'color 0.3s',
              }}
            >
              {step.label}
            </span>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              marginTop: 28,
              padding: '12px 16px',
              background: 'var(--error-bg)',
              border: '1px solid var(--error)',
              borderRadius: 6,
            }}
          >
            <p style={{ fontSize: 13, color: 'var(--error)', margin: '0 0 12px' }}>{errorMsg}</p>
            <button
              onClick={onBack}
              style={{
                fontSize: 13,
                color: 'var(--accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                minHeight: 44,
              }}
            >
              ← Try a different file
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <motion.svg
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        width="18" height="18" viewBox="0 0 18 18" fill="none"
        style={{ flexShrink: 0 }}
      >
        <circle cx="9" cy="9" r="9" fill="var(--accent)" opacity="0.15" />
        <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
    )
  }
  if (state === 'active') {
    return (
      <motion.div
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{
          width: 18, height: 18, borderRadius: '50%',
          border: '2px solid var(--accent)',
          flexShrink: 0,
        }}
      />
    )
  }
  if (state === 'error') {
    return (
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: 'var(--error)', opacity: 0.15, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'var(--error)', fontSize: 12, fontWeight: 700 }}>✕</span>
      </div>
    )
  }
  return (
    <div style={{
      width: 18, height: 18, borderRadius: '50%',
      border: '2px solid var(--border-strong)',
      flexShrink: 0,
    }} />
  )
}
