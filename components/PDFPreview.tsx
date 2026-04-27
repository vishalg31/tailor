'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { ResumeJSONType, TailoredJSONType } from '@/lib/schema'

interface Props {
  resumeJson: ResumeJSONType
  tailoredJson: TailoredJSONType
}

const PDFPreviewInner = dynamic(() => import('./PDFPreviewInner'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading PDF preview...</p>
    </div>
  ),
})

const PDFDownloadOnly = dynamic(
  () => import('./PDFPreviewInner').then(m => ({ default: m.PDFDownloadButton })),
  { ssr: false, loading: () => null },
)

export function PDFPreview({ resumeJson, tailoredJson }: Props) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div>
      {/* Desktop: always show full viewer */}
      <div className="hidden md:block">
        <PDFPreviewInner resumeJson={resumeJson} tailoredJson={tailoredJson} />
      </div>

      {/* Mobile: toggle + download */}
      <div className="block md:hidden">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: showPreview ? 16 : 0 }}>
          <button
            onClick={() => setShowPreview(v => !v)}
            className="btn-ghost"
            style={{ fontSize: 13 }}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <PDFDownloadOnly resumeJson={resumeJson} tailoredJson={tailoredJson} />
        </div>
        {showPreview && (
          <PDFPreviewInner resumeJson={resumeJson} tailoredJson={tailoredJson} />
        )}
      </div>
    </div>
  )
}
