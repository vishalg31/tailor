'use client'

import type { ResumeJSONType } from '@/lib/schema'
import { InfoTip } from '@/components/InfoTip'

interface Props {
  resumeJson: ResumeJSONType
  notice?: string | null
  onContinue: () => void
  onReupload: () => void
}

function exportJson(resumeJson: ResumeJSONType) {
  const blob = new Blob([JSON.stringify(resumeJson, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${resumeJson.name.replace(/\s+/g, '_')}_CV_data.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function CVPreview({ resumeJson, notice, onContinue, onReupload }: Props) {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 16px' }}>
      {notice && (
        <div style={{ marginBottom: 20, padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 6, fontSize: 13, color: 'var(--accent)' }}>
          {notice}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            {resumeJson.name}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
            {[resumeJson.email, resumeJson.phone, resumeJson.location].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => exportJson(resumeJson)}
              style={{
                fontSize: 13,
                color: 'var(--accent)',
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent)',
                borderRadius: 6,
                cursor: 'pointer',
                padding: '6px 12px',
                minHeight: 36,
                fontWeight: 500,
              }}
            >
              Export CV data ↓
            </button>
            <InfoTip text="Save your CV data as a JSON file. Re-import it next time to skip parsing and save processing time." />
          </div>
          <button
            onClick={onReupload}
            style={{ fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, minHeight: 44 }}
          >
            Re-upload CV
          </button>
        </div>
      </div>

      {resumeJson.summary && (
        <Section title="Summary">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{resumeJson.summary}</p>
        </Section>
      )}

      <Section title={`Experience (${resumeJson.experience.length} roles)`}>
        {resumeJson.experience.map((exp, i) => (
          <div key={i} style={{ marginBottom: i < resumeJson.experience.length - 1 ? 20 : 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px', color: 'var(--text-primary)' }}>
              {exp.title} · {exp.company}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 8px' }}>
              {exp.startDate} – {exp.endDate}
            </p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {exp.bullets.map((b, j) => (
                <li key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 4 }}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Education">
        {resumeJson.education.map((ed, i) => (
          <p key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
            {ed.degree} · {ed.institution} · {ed.year}
          </p>
        ))}
      </Section>

      <Section title="Skills">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          {resumeJson.skills.join(', ')}
        </p>
      </Section>

      <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-primary" onClick={onContinue}>
          Looks good — Paste job description →
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 12px',
        fontWeight: 500,
      }}>
        {title}
      </p>
      {children}
      <hr className="divider" style={{ marginTop: 20 }} />
    </div>
  )
}
