'use client'

import { useState } from 'react'
import { timeAgo } from '@/lib/utils'
import { db } from '@/lib/db'
import type { SessionRecord } from '@/lib/db'

interface Props {
  sessions: SessionRecord[]
  onResume: (session: SessionRecord) => void
  onDelete: (session: SessionRecord) => void
  onRename: (session: SessionRecord, newName: string) => void
}

async function exportSession(s: SessionRecord) {
  const resume = await db.resumeJson.get(s.cvHash)
  if (!resume) return
  const blob = new Blob([JSON.stringify(resume.data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${resume.data.name.replace(/\s+/g, '_')}_CV_data.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function SessionDashboard({ sessions, onResume, onDelete, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [expandedJdId, setExpandedJdId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (sessions.length === 0) return null

  const commitRename = (s: SessionRecord) => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== s.name) onRename(s, trimmed)
    setEditingId(null)
  }

  return (
    <div style={{ marginTop: 32 }}>
      <p className="eyebrow">Recent sessions</p>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {sessions.map((s, i) => (
          <div key={s.sessionId}>
            {/* Main row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: (i < sessions.length - 1 || expandedJdId === s.sessionId) ? '1px solid var(--border)' : 'none',
              }}
            >
              {/* Left: name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  {editingId === s.sessionId ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitRename(s)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(s); if (e.key === 'Escape') setEditingId(null) }}
                      style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                        background: 'var(--bg-secondary)', border: '1px solid var(--accent)',
                        borderRadius: 4, padding: '1px 6px', fontFamily: 'inherit',
                        outline: 'none', minWidth: 0, width: '180px',
                      }}
                    />
                  ) : (
                    <span
                      title="Click to rename"
                      onClick={() => { setEditingId(s.sessionId); setEditValue(s.name) }}
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'text' }}
                    >
                      {s.name}
                    </span>
                  )}
                  {s.company && (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--border-strong)' }}>·</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {s.role ? `${s.role} at ` : ''}{s.company}
                      </span>
                    </>
                  )}
                  {s.matchScore != null && (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--border-strong)' }}>·</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                        background: 'var(--accent-dim)', padding: '1px 7px', borderRadius: 20,
                      }}>
                        {s.matchScore} pts
                      </span>
                    </>
                  )}
                </div>
                {/* Sub-row: timestamp + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(s.updatedAt)}</span>
                  {s.jdText && (
                    <button
                      onClick={() => setExpandedJdId(expandedJdId === s.sessionId ? null : s.sessionId)}
                      style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    >
                      {expandedJdId === s.sessionId ? 'Hide JD ▲' : 'View JD ▼'}
                    </button>
                  )}
                  <button
                    onClick={() => exportSession(s)}
                    style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                  >
                    Export
                  </button>
                  {confirmDeleteId === s.sessionId ? (
                    <button
                      onClick={() => { onDelete(s); setConfirmDeleteId(null) }}
                      style={{ fontSize: 11, color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}
                    >
                      Confirm delete?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(s.sessionId)}
                      onBlur={() => setConfirmDeleteId(null)}
                      style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Right: resume */}
              <button
                onClick={() => onResume(s)}
                style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 20, flexShrink: 0, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                Resume →
              </button>
            </div>

            {/* JD text expand */}
            {expandedJdId === s.sessionId && s.jdText && (
              <div style={{
                padding: '12px 20px',
                background: 'var(--bg-secondary)',
                borderBottom: i < sessions.length - 1 ? '1px solid var(--border)' : 'none',
                maxHeight: 200,
                overflowY: 'auto',
              }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {s.jdText}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
