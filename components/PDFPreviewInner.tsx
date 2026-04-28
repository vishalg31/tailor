'use client'

import { useEffect, useState } from 'react'
import { PDFViewer, PDFDownloadLink, pdf } from '@react-pdf/renderer'
import { ResumeDocument } from './ResumeTemplate'
import type { ResumeJSONType, TailoredJSONType } from '@/lib/schema'
import { InfoTip } from '@/components/InfoTip'

interface Props {
  resumeJson: ResumeJSONType
  tailoredJson: TailoredJSONType
}

function useOverflowDetect(resumeJson: ResumeJSONType, tailoredJson: TailoredJSONType): boolean {
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    setOverflows(false)
    let cancelled = false
    pdf(<ResumeDocument resumeJson={resumeJson} tailoredJson={tailoredJson} compact={false} />)
      .toBlob()
      .then(async blob => {
        if (cancelled) return
        const buf = await blob.arrayBuffer()
        const text = new TextDecoder('latin1').decode(buf)
        const pages = (text.match(/\/Type\s*\/Page\b/g) || []).length
        if (!cancelled && pages > 1) setOverflows(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [resumeJson, tailoredJson])

  return overflows
}

function PDFDownloadButtonCore({ resumeJson, tailoredJson, compact }: Props & { compact: boolean }) {
  const filename = `${resumeJson.name.replace(/\s+/g, '_')}_tailored.pdf`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <PDFDownloadLink
        document={<ResumeDocument resumeJson={resumeJson} tailoredJson={tailoredJson} compact={compact} />}
        fileName={filename}
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          minHeight: 44,
          lineHeight: '24px',
        }}
      >
        {({ loading }) => loading ? 'Preparing PDF...' : 'Download PDF'}
      </PDFDownloadLink>
      <InfoTip text="Generates a formatted PDF of your tailored CV using your original layout. Ready to submit to employers." />
    </span>
  )
}

// Standalone mobile download button — auto-applies compact if overflows (no visual toggle needed)
export function PDFDownloadButton({ resumeJson, tailoredJson }: Props) {
  const compact = useOverflowDetect(resumeJson, tailoredJson)
  return <PDFDownloadButtonCore resumeJson={resumeJson} tailoredJson={tailoredJson} compact={compact} />
}

export default function PDFPreviewInner({ resumeJson, tailoredJson }: Props) {
  const overflows = useOverflowDetect(resumeJson, tailoredJson)
  const [compact, setCompact] = useState(false)

  // Reset compact when content changes
  useEffect(() => { setCompact(false) }, [resumeJson, tailoredJson])

  return (
    <div className="glass" style={{ borderRadius: 8, overflow: 'hidden' }}>
      <PDFViewer width="100%" style={{ height: 'clamp(420px, 70vh, 600px)' }} showToolbar={false}>
        <ResumeDocument resumeJson={resumeJson} tailoredJson={tailoredJson} compact={compact} />
      </PDFViewer>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {overflows && (
            <button
              onClick={() => setCompact(v => !v)}
              style={{
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: compact ? 'var(--accent)' : 'none',
                color: compact ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {compact ? 'Compact on' : 'Compact'}
            </button>
          )}
        </div>
        <PDFDownloadButtonCore resumeJson={resumeJson} tailoredJson={tailoredJson} compact={compact} />
      </div>
    </div>
  )
}
