import { db } from './db'

const SESSION_LIMIT = parseInt(process.env.NEXT_PUBLIC_SESSION_LIMIT ?? '5', 10)
const PARSE_LIMIT = parseInt(process.env.NEXT_PUBLIC_PARSE_LIMIT ?? '5', 10)
const WARNING_THRESHOLD = 2

export type ApiUsageStatus =
  | { status: 'ok'; remainingToday: number }
  | { status: 'warning'; remainingToday: number }
  | { status: 'session_blocked' }
  // ip_blocked and global_blocked are V2 (Upstash Redis)

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getResetTimeLocal(): string {
  const now = new Date()
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0
  ))
  return midnight.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export async function checkApiUsage(sessionId: string): Promise<ApiUsageStatus> {
  const today = todayUTC()
  const record = await db.usageCounters.get(sessionId)

  const sessionCount = (record && record.date === today) ? record.count : 0
  const remaining = SESSION_LIMIT - sessionCount

  if (remaining <= 0) return { status: 'session_blocked' }
  if (remaining <= WARNING_THRESHOLD) return { status: 'warning', remainingToday: remaining }
  return { status: 'ok', remainingToday: remaining }
}

export async function incrementUsage(sessionId: string): Promise<void> {
  const today = todayUTC()
  const record = await db.usageCounters.get(sessionId)

  if (record && record.date === today) {
    await db.usageCounters.update(sessionId, { count: record.count + 1 })
  } else {
    await db.usageCounters.put({ sessionId, count: 1, date: today })
  }
}

export async function checkParseUsage(sessionId: string): Promise<ApiUsageStatus> {
  const today = todayUTC()
  const record = await db.usageCounters.get(sessionId)
  const parseCount = (record && record.date === today) ? (record.parseCount ?? 0) : 0
  const remaining = PARSE_LIMIT - parseCount
  if (remaining <= 0) return { status: 'session_blocked' }
  if (remaining <= WARNING_THRESHOLD) return { status: 'warning', remainingToday: remaining }
  return { status: 'ok', remainingToday: remaining }
}

export async function incrementParseUsage(sessionId: string): Promise<void> {
  const today = todayUTC()
  const record = await db.usageCounters.get(sessionId)
  if (record && record.date === today) {
    await db.usageCounters.update(sessionId, { parseCount: (record.parseCount ?? 0) + 1 })
  } else {
    await db.usageCounters.put({ sessionId, count: record?.count ?? 0, parseCount: 1, date: today })
  }
}
