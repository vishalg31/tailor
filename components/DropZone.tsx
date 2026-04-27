'use client'

import { useCallback, useRef, useState } from 'react'

interface Props {
  onFileAccepted: (file: File) => void
  disabled?: boolean
}

const ACCEPTED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const MAX_SIZE = 3 * 1024 * 1024

export function DropZone({ onFileAccepted, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validate = (file: File): string | null => {
    if (file.size > MAX_SIZE) return 'File exceeds 3MB. Please upload a smaller PDF or DOCX.'
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED.includes(file.type) && ext !== 'pdf' && ext !== 'docx') {
      return 'Unsupported format. Please upload a PDF or DOCX.'
    }
    return null
  }

  const handleFile = useCallback((file: File) => {
    const err = validate(file)
    if (err) { setError(err); return }
    setError(null)
    onFileAccepted(file)
  }, [onFileAccepted])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      {/* Desktop drop zone */}
      <div
        className="hidden md:block"
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{
          background: dragging ? 'var(--accent-dim)' : 'var(--surface)',
          border: `1.5px dashed ${dragging ? 'var(--accent)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--radius)',
          padding: '36px 32px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
          opacity: disabled ? 0.5 : 1,
          boxShadow: dragging ? 'none' : 'var(--shadow)',
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ margin: '0 auto', display: 'block' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
          Drop your CV here or{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>click to upload</span>
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
          PDF or DOCX · Max 3MB
        </p>
      </div>

      {/* Mobile tap-to-upload */}
      <div className="block md:hidden">
        <button
          className="btn-primary"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled}
          style={{ width: '100%', fontSize: 15 }}
        >
          Upload your CV
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        style={{ display: 'none' }}
      />

      {error && (
        <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 10 }}>{error}</p>
      )}
    </div>
  )
}
