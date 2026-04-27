'use client'

import { useState } from 'react'
import { clearAllData } from '@/lib/db'

export function ClearDataButton() {
  const [confirming, setConfirming] = useState(false)

  const handleClick = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    await clearAllData()
    setConfirming(false)
    window.location.href = '/'
  }

  return (
    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
      <div style={{
        border: '1.5px solid var(--error)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 20px',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}>
        <button
          onClick={handleClick}
          onBlur={() => setConfirming(false)}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--error)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            minHeight: 36,
            whiteSpace: 'nowrap',
          }}
        >
          {confirming ? 'Click again to confirm — this cannot be undone.' : 'Clear My Data'}
        </button>
        {!confirming && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, textAlign: 'center' }}>
            Deletes all CV data and sessions from this browser.
          </p>
        )}
      </div>
    </div>
  )
}
