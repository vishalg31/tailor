'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/db'
import { hashString } from '@/lib/utils'
import { incrementUsage, checkApiUsage } from '@/lib/checkApiUsage'
import { RateLimitBar } from '@/components/RateLimitBar'
import type { ApiUsageStatus } from '@/lib/checkApiUsage'
import { DropZone } from '@/components/DropZone'
import { ParseStepper } from '@/components/ParseStepper'
import { CVPreview } from '@/components/CVPreview'
import { JDInput } from '@/components/JDInput'
import { TailorStepper } from '@/components/TailorStepper'
import { SniperView } from '@/components/SniperView'
import { PDFPreview } from '@/components/PDFPreview'
import { SessionDashboard } from '@/components/SessionDashboard'
import { ClearDataButton } from '@/components/ClearDataButton'
import { ResumeJSON } from '@/lib/schema'
import type { ResumeJSONType, TailoredJSONType, ATSScoreType } from '@/lib/schema'
import type { SessionRecord } from '@/lib/db'

type AppStep = 'landing' | 'parsing' | 'cv-preview' | 'jd-input' | 'tailoring' | 'results'

const PAGE_MAX = 800

export default function TailorPage() {
  const [step, setStep] = useState<AppStep>('landing')
  const [file, setFile] = useState<File | null>(null)
  const [resumeJson, setResumeJson] = useState<ResumeJSONType | null>(null)
  const [cvHash, setCvHash] = useState<string>('')
  const [jdText, setJdText] = useState('')
  const [tailoredJson, setTailoredJson] = useState<TailoredJSONType | null>(null)
  const [originalScore, setOriginalScore] = useState<ATSScoreType | null>(null)
  const [tailoredScore, setTailoredScore] = useState<ATSScoreType | null>(null)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [usageStatus, setUsageStatus] = useState<ApiUsageStatus | null>(null)
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const today = new Date().toISOString().slice(0, 10)
    const storedId   = localStorage.getItem('tailor_session_id')
    const storedDate = localStorage.getItem('tailor_session_date')
    if (storedId && storedDate === today) return storedId
    const newId = crypto.randomUUID()
    localStorage.setItem('tailor_session_id', newId)
    localStorage.setItem('tailor_session_date', today)
    return newId
  })
  const [importError, setImportError] = useState<string | null>(null)
  const [resultNotice, setResultNotice] = useState<string | null>(null)
  const [showJd, setShowJd] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Load last 10 sessions on mount + auto-restore last active session
  useEffect(() => {
    db.sessions.orderBy('updatedAt').reverse().limit(10).toArray().then(setSessions)

    const restore = localStorage.getItem('tailor_restore')
    if (!restore) return
    try {
      const { cvHash: savedCvHash, jdHash: savedJdHash } = JSON.parse(restore)
      Promise.all([
        db.resumeJson.get(savedCvHash),
        savedJdHash ? db.tailoredJson.get(savedJdHash) : Promise.resolve(null),
        savedJdHash ? db.sessions.get(`${savedCvHash}_${savedJdHash}`) : Promise.resolve(null),
      ]).then(([resume, tailored, session]) => {
        if (!resume) return
        setResumeJson(resume.data)
        setCvHash(savedCvHash)
        if (session?.jdText) setJdText(session.jdText)
        if (tailored) {
          setTailoredJson(tailored.data)
          setOriginalScore(tailored.originalScore ?? null)
          setTailoredScore(tailored.tailoredScore ?? null)
          setStep('results')
        } else {
          setStep('cv-preview')
        }
      })
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    checkApiUsage(sessionId).then(setUsageStatus)
  }, [sessionId])

  useEffect(() => {
    const handler = () => {
      setStep('landing')
      setResultNotice(null)
      db.sessions.orderBy('updatedAt').reverse().limit(10).toArray().then(setSessions)
      checkApiUsage(sessionId).then(setUsageStatus)
    }
    window.addEventListener('tailor:go-home', handler)
    return () => window.removeEventListener('tailor:go-home', handler)
  }, [])


  const handleFileAccepted = (f: File) => {
    localStorage.removeItem('tailor_restore')
    setFile(f)
    setTailoredJson(null)
    setJdText('')
    setStep('parsing')
  }

  const handleParseComplete = async (json: ResumeJSONType, hash: string) => {
    setResumeJson(json)
    setCvHash(hash)
    // Cache parsed CV
    await db.resumeJson.put({ cvHash: hash, data: json, fileName: file?.name ?? '', createdAt: Date.now() })
    setStep('cv-preview')
  }

  const handleTailor = async () => {
    const jdHash = hashString(jdText)
    const existing = await db.tailoredJson.get(jdHash)
    if (existing && existing.cvHash === cvHash) {
      setTailoredJson(existing.data)
      setOriginalScore(existing.originalScore ?? null)
      setTailoredScore(existing.tailoredScore ?? null)
      setResultNotice('Already tailored for this job — showing previous results.')
      setStep('results')
      return
    }
    await incrementUsage(sessionId)
    checkApiUsage(sessionId).then(setUsageStatus)
    setStep('tailoring')
  }

  const handleTailorComplete = async (json: TailoredJSONType, origScore: ATSScoreType | null, tailScore: ATSScoreType | null) => {
    setTailoredJson(json)
    setOriginalScore(origScore)
    setTailoredScore(tailScore)
    const jdHash = hashString(jdText)
    await db.tailoredJson.put({
      jdHash,
      cvHash,
      jdSnippet: jdText.slice(0, 120),
      data: json,
      originalScore: origScore ?? undefined,
      tailoredScore: tailScore ?? undefined,
      createdAt: Date.now(),
    })
    await db.sessions.put({
      sessionId: `${cvHash}_${jdHash}`,
      name: file?.name ?? resumeJson!.name,
      fileName: file?.name ?? resumeJson!.name,
      cvHash,
      jdHash,
      jdText,
      company: json.tailoredExperience?.[0]?.company,
      role: json.tailoredExperience?.[0]?.title,
      matchScore: tailScore?.totalScore,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setResultNotice(null)
    db.sessions.orderBy('updatedAt').reverse().limit(10).toArray().then(setSessions)
    localStorage.setItem('tailor_restore', JSON.stringify({ cvHash, jdHash }))
    setStep('results')
  }

  const refreshSessions = () =>
    db.sessions.orderBy('updatedAt').reverse().limit(10).toArray().then(setSessions)

  const handleDeleteSession = async (session: SessionRecord) => {
    await db.sessions.delete(session.sessionId)
    refreshSessions()
  }

  const handleRenameSession = async (session: SessionRecord, newName: string) => {
    await db.sessions.update(session.sessionId, { name: newName, updatedAt: Date.now() })
    refreshSessions()
  }

  const handleResume = async (session: SessionRecord) => {
    const resume = await db.resumeJson.get(session.cvHash)
    if (!resume) return
    setResumeJson(resume.data)
    setCvHash(session.cvHash)
    if (session.jdText) setJdText(session.jdText)
    if (session.jdHash) {
      const tailored = await db.tailoredJson.get(session.jdHash)
      if (tailored) {
        setTailoredJson(tailored.data)
        setOriginalScore(tailored.originalScore ?? null)
        setTailoredScore(tailored.tailoredScore ?? null)
        setStep('results')
        return
      }
    }
    setStep('cv-preview')
  }

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    setImportError(null)
    try {
      const text = await f.text()
      const raw = JSON.parse(text)
      const result = ResumeJSON.safeParse(raw)
      if (!result.success) {
        setImportError('File is not a valid Tailor CV export. Please use a file exported from this app.')
        return
      }
      const json = result.data
      const hash = hashString(JSON.stringify(json))
      await db.resumeJson.put({ cvHash: hash, data: json, fileName: f.name, createdAt: Date.now() })
      setResumeJson(json)
      setCvHash(hash)
      setTailoredJson(null)
      setJdText('')
      setStep('cv-preview')
    } catch {
      setImportError('Could not read the file. Make sure it is a valid JSON export.')
    }
  }

  return (
    <div style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: '0 16px' }}>
      <AnimatePresence mode="wait">
        {step === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            style={{ paddingTop: 72, paddingBottom: 64 }}
          >
            {/* Hidden file input for JSON import */}
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImportJson}
            />

            {sessions.length === 0 ? (
              /* ── Empty state ───────────────────────────────── */
              <div style={{ maxWidth: 540, marginBottom: 48 }}>

                {/* Feature chips */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
                  {['ATS scoring', 'Word-level diff', 'PDF export', 'Zero data stored'].map(f => (
                    <span key={f} style={{
                      fontSize: 11, fontWeight: 700,
                      color: 'var(--accent)',
                      background: 'var(--accent-dim)',
                      borderRadius: 20, padding: '3px 10px',
                      letterSpacing: '0.02em',
                    }}>
                      {f}
                    </span>
                  ))}
                </div>

                {/* DM Serif headline */}
                <h1 style={{
                  fontFamily: 'var(--font-dm-serif, Georgia, serif)',
                  fontSize: 'clamp(32px, 6vw, 44px)',
                  fontWeight: 400,
                  lineHeight: 1.15,
                  margin: '0 0 16px',
                  color: 'var(--text-primary)',
                }}>
                  Tailor your CV to <em>any job</em><br />in 60 seconds.
                </h1>

                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 32px' }}>
                  Paste a job description. Get an ATS-optimised CV with rewritten bullets, a match score, and a one-click PDF. Your data never leaves your browser.
                </p>

                {/* How it works */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                  {[
                    { n: '1', label: 'Upload CV' },
                    { n: '2', label: 'Paste job description' },
                    { n: '3', label: 'Get tailored CV + score' },
                  ].map((s, i, arr) => (
                    <span key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>{s.n}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
                      {i < arr.length - 1 && (
                        <span style={{ color: 'var(--border-strong)', fontSize: 14, marginLeft: 4 }}>→</span>
                      )}
                    </span>
                  ))}
                </div>

                <DropZone onFileAccepted={handleFileAccepted} />
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="btn-link"
                  style={{ paddingTop: 12, display: 'block', fontSize: 12 }}
                >
                  Or import saved CV data (.json) →
                </button>
                {importError && (
                  <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 8 }}>{importError}</p>
                )}
              </div>
            ) : (
              /* ── Sessions exist ────────────────────────────── */
              <div>
                <div style={{ marginBottom: 32 }}>
                  {/* Feature chips */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {['ATS scoring', 'Word-level diff', 'PDF export', 'Zero data stored'].map(f => (
                      <span key={f} style={{
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--accent)',
                        background: 'var(--accent-dim)',
                        borderRadius: 20, padding: '3px 10px',
                        letterSpacing: '0.02em',
                      }}>{f}</span>
                    ))}
                  </div>

                  <h1 style={{
                    fontFamily: 'var(--font-dm-serif, Georgia, serif)',
                    fontSize: 28, fontWeight: 400,
                    margin: '0 0 20px', lineHeight: 1.2,
                    color: 'var(--text-primary)',
                  }}>
                    Tailor your CV to <em>any job</em> in 60 seconds.
                  </h1>

                  <RateLimitBar status={usageStatus} />
                  <DropZone onFileAccepted={handleFileAccepted} />
                  <button
                    onClick={() => importInputRef.current?.click()}
                    className="btn-link"
                    style={{ paddingTop: 12, display: 'block', fontSize: 12 }}
                  >
                    Or import saved CV data (.json) →
                  </button>
                  {importError && (
                    <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 8 }}>{importError}</p>
                  )}
                </div>
                <SessionDashboard sessions={sessions} onResume={handleResume} onDelete={handleDeleteSession} onRename={handleRenameSession} />
                <ClearDataButton />
              </div>
            )}

          </motion.div>
        )}

        {step === 'parsing' && file && (
          <motion.div key="parsing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ParseStepper
              file={file}
              onComplete={handleParseComplete}
              onError={() => {}}
              onBack={() => setStep('landing')}
            />
          </motion.div>
        )}

        {step === 'cv-preview' && resumeJson && (
          <motion.div key="cv-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CVPreview
              resumeJson={resumeJson}
              onContinue={() => setStep('jd-input')}
              onReupload={() => setStep('landing')}
            />
          </motion.div>
        )}

        {step === 'jd-input' && (
          <motion.div key="jd-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <JDInput
              jdText={jdText}
              onChange={setJdText}
              onTailor={handleTailor}
              sessionId={sessionId}
              onBack={() => setStep('cv-preview')}
            />
          </motion.div>
        )}

        {step === 'tailoring' && resumeJson && (
          <motion.div key="tailoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TailorStepper
              resumeJson={resumeJson}
              jdText={jdText}
              onComplete={(tj, os, ts) => handleTailorComplete(tj, os, ts)}
              onError={() => {}}
            />
          </motion.div>
        )}

        {step === 'results' && resumeJson && tailoredJson && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {resultNotice && (
              <div style={{ marginTop: 24, padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 6, fontSize: 13, color: 'var(--accent)' }}>
                {resultNotice}
              </div>
            )}

            {/* Results header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 32,
              paddingBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <button
                onClick={() => { setResultNotice(null); setStep('jd-input') }}
                style={{ fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, minHeight: 44 }}
              >
                ← Try a different JD
              </button>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {jdText && (
                  <button
                    onClick={() => setShowJd(v => !v)}
                    style={{ fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, minHeight: 44 }}
                  >
                    {showJd ? 'Hide JD ▲' : 'View JD ▼'}
                  </button>
                )}
                <button
                  onClick={() => setStep('landing')}
                  style={{ fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, minHeight: 44 }}
                >
                  Upload new CV
                </button>
              </div>
            </div>

            {showJd && jdText && (
              <div style={{
                marginBottom: 24,
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                maxHeight: 220,
                overflowY: 'auto',
              }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {jdText}
                </p>
              </div>
            )}

            {/* Results — Sniper + PDF side by side on large screens */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: 32,
              }}
              className="results-grid"
            >
              <SniperView resumeJson={resumeJson} tailoredJson={tailoredJson} originalScore={originalScore} tailoredScore={tailoredScore} />
            </div>

            {/* PDF Preview — full width below on medium+, hidden on mobile */}
            <div style={{ paddingBottom: 64 }}>
              <hr className="divider" style={{ margin: '32px 0' }} />
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                Export as PDF
              </p>
              <PDFPreview
                resumeJson={resumeJson}
                tailoredJson={tailoredJson}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
