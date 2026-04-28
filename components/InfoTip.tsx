'use client'

import { useState } from 'react'

export function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={e => { e.stopPropagation(); setShow(v => !v) }}
        style={{
          width: 14, height: 14,
          borderRadius: '50%',
          border: '1px solid var(--border-strong)',
          background: 'none',
          color: 'var(--text-tertiary)',
          fontSize: 9, fontWeight: 700,
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          lineHeight: 1,
          fontFamily: 'inherit',
        }}
        aria-label="What does this do?"
      >
        i
      </button>
      {show && (
        <span style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          whiteSpace: 'normal',
          width: 200,
          boxShadow: 'var(--shadow)',
          zIndex: 50,
          pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  )
}
