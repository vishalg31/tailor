'use client'

import { useEffect, useState } from 'react'
import { MODELS } from '@/lib/models'

interface GeminiModel {
  id: string
  displayName: string
  inputTokenLimit: number
  outputTokenLimit: number
  streaming: boolean
}

interface ModelOverrides {
  parsing: string
  tailoring: string
  scoring: string
}

const STORAGE_KEY = 'tailor_dev_models'

export function DevModelPanel() {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<GeminiModel[]>([])
  const [loading, setLoading] = useState(false)
  const [overrides, setOverrides] = useState<ModelOverrides>({
    parsing: MODELS.parsing,
    tailoring: MODELS.tailoring,
    scoring: MODELS.scoring,
  })

  // Load saved overrides on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { setOverrides(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [])

  const fetchModels = async () => {
    if (models.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/dev/models')
      const data = await res.json()
      setModels(data.models ?? [])
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setOpen(v => !v)
    fetchModels()
  }

  const handleChange = (key: keyof ModelOverrides, value: string) => {
    const next = { ...overrides, [key]: value }
    setOverrides(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const handleReset = () => {
    const defaults = {
      parsing: MODELS.parsing,
      tailoring: MODELS.tailoring,
      scoring: MODELS.scoring,
    }
    setOverrides(defaults)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 8px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        ⚙ Models
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            right: 0,
            width: 360,
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)',
            padding: 16,
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Dev — Model Overrides
            </span>
            <button onClick={handleReset} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Reset defaults
            </button>
          </div>

          {loading && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0' }}>Fetching models...</p>
          )}

          {[
            { key: 'parsing' as const, label: 'Parsing' },
            { key: 'tailoring' as const, label: 'Tailoring (streaming)' },
            { key: 'scoring' as const, label: 'Scoring (ATS eval)' },
          ].map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 4px', fontWeight: 600 }}>{label}</p>
              <select
                value={overrides[key]}
                onChange={e => handleChange(key, e.target.value)}
                style={{
                  width: '100%',
                  fontSize: 12,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '5px 8px',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                }}
              >
                <option value={overrides[key]}>{overrides[key]}</option>
                {models
                  .filter(m => m.id !== overrides[key])
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.outputTokenLimit.toLocaleString()} out){key === 'tailoring' && !m.streaming ? ' ⚠ no stream' : ''}
                    </option>
                  ))}
              </select>
            </div>
          ))}

          {models.length > 0 && (
            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
              {models.length} models available on your API key · Tailoring requires streaming
            </p>
          )}
        </div>
      )}
    </div>
  )
}
