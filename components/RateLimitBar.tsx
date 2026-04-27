'use client'

import type { ApiUsageStatus } from '@/lib/checkApiUsage'
import { getResetTimeLocal } from '@/lib/checkApiUsage'

interface Props {
  status: ApiUsageStatus | null
}

export function RateLimitBar({ status }: Props) {
  if (!status || status.status === 'ok') {
    const remaining = status?.status === 'ok' ? status.remainingToday : null
    if (!remaining) return null
    return (
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
        {remaining} tailoring call{remaining !== 1 ? 's' : ''} remaining this session
      </p>
    )
  }

  if (status.status === 'warning') {
    return (
      <div
        style={{
          background: 'var(--warning-bg)',
          border: '1px solid var(--warning)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 12,
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--warning)', margin: 0 }}>
          You have {status.remainingToday} tailoring call{status.remainingToday !== 1 ? 's' : ''} left this session.
          Use them wisely — limit resets at {getResetTimeLocal()}.
        </p>
      </div>
    )
  }

  if (status.status === 'session_blocked') {
    return (
      <div
        style={{
          background: 'var(--error-bg)',
          border: '1px solid var(--error)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 12,
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--error)', margin: 0 }}>
          You&apos;ve made 5 tailoring calls this session. Refresh the page to continue.
        </p>
      </div>
    )
  }

  return null
}
