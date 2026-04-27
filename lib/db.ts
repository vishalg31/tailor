import Dexie, { type Table } from 'dexie'
import type { ResumeJSONType, TailoredJSONType, ATSScoreType } from './schema'

export interface SessionRecord {
  sessionId: string
  name: string
  cvHash: string
  fileName: string
  jdHash?: string
  jdText?: string
  company?: string
  role?: string
  matchScore?: number
  createdAt: number
  updatedAt: number
}

export interface ResumeJsonRecord {
  cvHash: string
  data: ResumeJSONType
  fileName: string
  createdAt: number
}

export interface TailoredJsonRecord {
  jdHash: string
  cvHash: string
  jdSnippet: string
  data: TailoredJSONType
  originalScore?: ATSScoreType
  tailoredScore?: ATSScoreType
  createdAt: number
}

export interface UsageCounter {
  sessionId: string
  count: number
  date: string
}

class TailorDB extends Dexie {
  sessions!: Table<SessionRecord>
  resumeJson!: Table<ResumeJsonRecord>
  tailoredJson!: Table<TailoredJsonRecord>
  usageCounters!: Table<UsageCounter>

  constructor() {
    super('tailor-db-v2')
    this.version(1).stores({
      sessions: 'sessionId, cvHash, jdHash, updatedAt',
      resumeJson: 'cvHash',
      tailoredJson: 'jdHash, cvHash',
      usageCounters: 'sessionId',
    })
    // v2: session key changed to cvHash_jdHash — clear old UUID-keyed sessions
    this.version(2).stores({
      sessions: 'sessionId, cvHash, jdHash, updatedAt',
      resumeJson: 'cvHash',
      tailoredJson: 'jdHash, cvHash',
      usageCounters: 'sessionId',
    }).upgrade(tx => tx.table('sessions').clear())
  }
}

export const db = new TailorDB()

export async function clearAllData() {
  await db.sessions.clear()
  await db.resumeJson.clear()
  await db.tailoredJson.clear()
  // usageCounters intentionally NOT cleared — limit survives a data wipe
}
