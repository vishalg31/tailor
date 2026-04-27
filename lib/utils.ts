export function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

export function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) return objMatch[0]
  return text.trim()
}

export function resumeToText(
  resumeJson: { name: string; summary?: string | null; experience: { title: string; company: string; startDate: string; endDate: string; bullets: string[] }[]; education: { degree: string; institution: string; year: string }[]; skills: string[] },
  tailoredExperience?: { title: string; company: string; startDate: string; endDate: string; bullets: string[] }[],
  tailoredSummary?: string
): string {
  const exp = tailoredExperience ?? resumeJson.experience
  const summary = tailoredSummary ?? resumeJson.summary

  let text = resumeJson.name + '\n'
  if (summary) text += '\nSUMMARY\n' + summary + '\n'

  text += '\nEXPERIENCE\n'
  for (const e of exp) {
    text += `${e.title} at ${e.company} (${e.startDate} - ${e.endDate})\n`
    for (const b of e.bullets) text += `- ${b}\n`
  }

  text += '\nEDUCATION\n'
  for (const ed of resumeJson.education) {
    text += `${ed.degree} - ${ed.institution} (${ed.year})\n`
  }

  text += '\nSKILLS\n' + resumeJson.skills.join(', ') + '\n'
  return text
}

export type BoldSegment = { text: string; bold: boolean }

export function parseBold(text: string): BoldSegment[] {
  const parts: BoldSegment[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), bold: false })
    parts.push({ text: match[1], bold: true })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), bold: false })
  return parts.length ? parts : [{ text, bold: false }]
}

export function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}
