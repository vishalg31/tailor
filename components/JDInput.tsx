'use client'

import { useEffect, useState } from 'react'
import { wordCount } from '@/lib/utils'
import { checkApiUsage } from '@/lib/checkApiUsage'
import { RateLimitBar } from './RateLimitBar'
import type { ApiUsageStatus } from '@/lib/checkApiUsage'

const MIN_WORDS = 50
const MAX_WORDS = 5000

interface Props {
  jdText: string
  onChange: (text: string) => void
  onTailor: () => void
  sessionId: string
  onBack: () => void
}

export function JDInput({ jdText, onChange, onTailor, sessionId, onBack }: Props) {
  const [usageStatus, setUsageStatus] = useState<ApiUsageStatus | null>(null)
  const [wordErr, setWordErr] = useState<string | null>(null)
  const count = wordCount(jdText)

  useEffect(() => {
    checkApiUsage(sessionId).then(setUsageStatus)
  }, [sessionId])

  const handleTailor = () => {
    if (count < MIN_WORDS) {
      setWordErr(`Job description is too short — add at least ${MIN_WORDS - count} more words.`)
      return
    }
    if (count > MAX_WORDS) {
      setWordErr(`Job description exceeds 5,000 words. Please trim it down.`)
      return
    }
    setWordErr(null)
    onTailor()
  }

  const blocked = usageStatus?.status === 'session_blocked'

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 16px' }}>
      <button className="btn-link" onClick={onBack} style={{ paddingBottom: 24, display: 'block' }}>
        ← Back to CV preview
      </button>

      <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-primary)' }}>
        Paste the job description
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        Copy the full job posting — the more detail, the better the tailoring.
      </p>

      <textarea
        value={jdText}
        onChange={e => {
          onChange(e.target.value)
          setWordErr(null)
        }}
        placeholder="Paste the full job description here..."
        rows={14}
        className={`field-input${wordErr ? ' error' : ''}`}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 20 }}>
        {wordErr
          ? <p style={{ fontSize: 12, color: 'var(--error)', margin: 0 }}>{wordErr}</p>
          : <p style={{ fontSize: 12, color: count < MIN_WORDS ? 'var(--text-tertiary)' : 'var(--accent)', margin: 0 }}>
              {count} words {count < MIN_WORDS && `(min ${MIN_WORDS})`}
            </p>
        }
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>max 5,000 words</p>
      </div>

      <RateLimitBar status={usageStatus} />

      <button
        className="btn-primary"
        onClick={handleTailor}
        disabled={blocked || count < MIN_WORDS}
      >
        Tailor my CV →
      </button>
    </div>
  )
}
