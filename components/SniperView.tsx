'use client'

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import type { ResumeJSONType, TailoredJSONType, ATSScoreType } from '@/lib/schema'
import { stripBold } from '@/lib/utils'

interface Props {
  resumeJson: ResumeJSONType
  tailoredJson: TailoredJSONType
  originalScore: ATSScoreType | null
  tailoredScore: ATSScoreType | null
}

export function SniperView({ resumeJson, tailoredJson, originalScore, tailoredScore }: Props) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 48px' }}>
      {/* Results title */}
      <div style={{ paddingTop: 40, marginBottom: 4 }}>
        <h2 style={{
          fontFamily: 'var(--font-dm-serif, Georgia, serif)',
          fontSize: 'clamp(22px, 4vw, 28px)',
          fontWeight: 700,
          margin: 0,
          color: 'var(--text-primary)',
          lineHeight: 1.2,
        }}>
          Your tailored CV is ready
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
          Here are the results
        </p>
      </div>

      {/* Match score */}
      {originalScore && tailoredScore ? (
        <MatchScore originalScore={originalScore} tailoredScore={tailoredScore} />
      ) : (
        <div style={{ paddingTop: 40, paddingBottom: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--warning)', margin: 0 }}>
            ATS scoring unavailable — daily limit reached. Come back tomorrow to see your scores.
          </p>
        </div>
      )}

      <hr className="divider" style={{ margin: '32px 0' }} />

      {/* Summary diff */}
      {tailoredJson.tailoredSummary && resumeJson.summary && (
        <>
          <SectionLabel>Summary</SectionLabel>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 24,
              marginBottom: 32,
            }}
          >
            <DiffColumn label="Original" text={resumeJson.summary} isAfter={false} />
            <DiffColumn label="Tailored" text={stripBold(tailoredJson.tailoredSummary)} isAfter={true} compareWith={resumeJson.summary} />
          </div>
          <hr className="divider" style={{ marginBottom: 32 }} />
        </>
      )}

      {/* Experience diffs */}
      {tailoredJson.tailoredExperience.map((tailored, idx) => {
        const original = resumeJson.experience[idx]
        if (!original) return null
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            style={{ marginBottom: 40 }}
          >
            <SectionLabel>{tailored.title} · {tailored.company}</SectionLabel>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 16px' }}>
              {tailored.startDate} – {tailored.endDate}
            </p>

            {/* Desktop: side-by-side columns */}
            <div className="hidden md:grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <BulletsColumn
                label="Before"
                bullets={original.bullets}
                isAfter={false}
              />
              <BulletsColumn
                label="After"
                bullets={tailored.bullets.map(stripBold)}
                isAfter={true}
                originalBullets={original.bullets}
              />
            </div>

            {/* Mobile: paired before/after per bullet */}
            <div className="block md:hidden">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {original.bullets.map((origBullet, bi) => (
                <div key={bi}>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>Before</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 12px' }}>{origBullet}</p>
                  <div className="card" style={{ padding: 16 }}>
                    <p style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>After</p>
                    <BulletRow
                      bullet={stripBold(tailored.bullets[bi] ?? origBullet)}
                      original={origBullet}
                      isAfter={true}
                    />
                  </div>
                </div>
              ))}
            </div>
            </div>
            {idx < tailoredJson.tailoredExperience.length - 1 && (
              <hr className="divider" style={{ marginTop: 32 }} />
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

/* ── Match Score ──────────────────────────────────────────── */
function MatchScore({ originalScore, tailoredScore }: {
  originalScore: ATSScoreType
  tailoredScore: ATSScoreType
}) {
  const delta = tailoredScore.totalScore - originalScore.totalScore
  const scoreColor = tailoredScore.totalScore >= 70 ? 'var(--accent)' : tailoredScore.totalScore >= 50 ? 'var(--warning)' : 'var(--error)'
  const deltaColor = delta >= 0 ? 'var(--accent)' : 'var(--error)'

  const breakdown = [
    { label: 'Keyword Match', key: 'hardKeywords' as const, maxScore: 50 },
    { label: 'Job Scope & Impact', key: 'jobScope' as const, maxScore: 25 },
    { label: 'Recency', key: 'recency' as const, maxScore: 15 },
    { label: 'Qualifications', key: 'qualifications' as const, maxScore: 10 },
  ]

  return (
    <div className="card" style={{ marginTop: 32 }}>
      {/* Score header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span className="serif" style={{ fontSize: 60, color: scoreColor, lineHeight: 1 }}>
            {tailoredScore.totalScore}
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor }}>
            {tailoredScore.scoreLabel}
          </span>
          {delta > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: deltaColor }}>
                +{delta} pts from tailoring
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                original score: {originalScore.totalScore}
              </span>
            </div>
          )}
        </div>
        {delta <= 0 && (
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 0' }}>
            {tailoredScore.totalScore >= 71
              ? 'Your CV is already well aligned with this role.'
              : tailoredScore.totalScore >= 51
              ? 'Moderate match — tailoring had limited room to improve.'
              : 'Weak match — this role may be outside your core domain.'}
          </p>
        )}
      </div>

      {/* Breakdown bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {breakdown.map(({ label, key, maxScore }) => {
          const orig = originalScore.breakdown[key].score
          const tail = tailoredScore.breakdown[key].score
          const d = tail - orig
          const pct = Math.round((tail / maxScore) * 100)
          return (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 160 }}>{label}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: scoreColor, borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 40, textAlign: 'right' }}>
                  {tail}<span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>/{maxScore}</span>
                  {delta > 0 && d !== 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: d > 0 ? 'var(--accent)' : 'var(--error)', marginLeft: 5 }}>
                      {d > 0 ? '+' : ''}{d}
                    </span>
                  )}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5, paddingLeft: 0 }}>
                {tailoredScore.breakdown[key].explanation}
              </p>
            </div>
          )
        })}
      </div>

      {/* Missing keywords */}
      {tailoredScore.missingKeywords.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Still missing</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tailoredScore.missingKeywords.map((keyword, i) => {
              const kw = keyword.toLowerCase()
              const suggestion = tailoredScore.placementSuggestions?.find(p => {
                const pk = p.keyword.toLowerCase()
                return pk === kw || kw.includes(pk) || pk.includes(kw)
              })?.suggestion
              return (
                <div key={i}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    padding: '3px 8px',
                  }}>
                    {keyword}
                  </span>
                  {suggestion && (
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0', paddingLeft: 2, lineHeight: 1.5 }}>
                      ↳ {suggestion}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Bullets column ───────────────────────────────────────── */
function BulletsColumn({ label, bullets, isAfter, originalBullets }: {
  label: string
  bullets: string[]
  isAfter: boolean
  originalBullets?: string[]
}) {
  const [copiedAll, setCopiedAll] = useState(false)

  const copyAll = async () => {
    await navigator.clipboard.writeText(bullets.join('\n'))
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  return (
    <div
      className={isAfter ? 'card' : ''}
      style={{ padding: isAfter ? 20 : '0' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <button
          onClick={copyAll}
          style={{ fontSize: 11, color: copiedAll ? 'var(--accent)' : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, minHeight: 44 }}
        >
          {copiedAll ? 'Copied!' : 'Copy all'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bullets.map((bullet, i) => (
          <BulletRow
            key={i}
            bullet={bullet}
            original={originalBullets?.[i]}
            isAfter={isAfter}
          />
        ))}
      </div>
    </div>
  )
}

function BulletRow({ bullet, original, isAfter }: { bullet: string; original?: string; isAfter: boolean }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(bullet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, group: true } as React.CSSProperties}>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
          margin: 0,
          flex: 1,
          textDecoration: !isAfter ? undefined : undefined,
        }}
      >
        {isAfter && original ? <DiffText before={original} after={bullet} /> : bullet}
      </p>
      {isAfter && (
        <button
          onClick={copy}
          title="Copy bullet"
          style={{
            color: copied ? 'var(--accent)' : 'var(--text-tertiary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            minHeight: 32,
            flexShrink: 0,
            transition: 'color 0.2s',
          }}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}

/* ── Word-level diff ──────────────────────────────────────── */
function DiffText({ before, after }: { before: string; after: string }) {
  const parts = computeWordDiff(before, after)
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'equal') return <span key={i}>{part.text}</span>
        if (part.type === 'added') return <span key={i} className="diff-added">{part.text}</span>
        return null
      })}
    </>
  )
}

function computeWordDiff(before: string, after: string) {
  const beforeWords = before.split(/(\s+)/)
  const afterWords = after.split(/(\s+)/)
  const beforeSet = new Set(beforeWords)
  const result: { type: 'equal' | 'added' | 'removed'; text: string }[] = []

  for (const word of afterWords) {
    if (beforeSet.has(word)) {
      result.push({ type: 'equal', text: word })
    } else {
      result.push({ type: 'added', text: word })
    }
  }
  return result
}

/* ── Helpers ──────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow" style={{ margin: '0 0 8px' }}>{children}</p>
}

function DiffColumn({ label, text, isAfter, compareWith }: {
  label: string
  text: string
  isAfter: boolean
  compareWith?: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <div className={isAfter ? 'card' : ''} style={{ padding: isAfter ? 20 : 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        {isAfter && (
          <button onClick={copy} style={{ fontSize: 11, color: copied ? 'var(--accent)' : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, minHeight: 44 }}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        {isAfter && compareWith ? <DiffText before={compareWith} after={text} /> : text}
      </p>
    </div>
  )
}
