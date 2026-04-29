import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { ResumeJSONType, TailoredJSONType } from '@/lib/schema'
import { parseBold } from '@/lib/utils'

interface Props {
  resumeJson: ResumeJSONType
  tailoredJson: TailoredJSONType
  compact: boolean
  matchedKeywords?: string[]
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 20,
    color: '#000000',
    lineHeight: 1.35,
  },
  outerBox: {
    border: '1.5pt solid #111111',
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  contactLine: {
    fontSize: 10,
    marginBottom: 6,
  },
  sectionHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textDecoration: 'underline',
    marginTop: 5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryText: {
    fontSize: 10,
    lineHeight: 1.4,
    marginBottom: 2,
  },
  roleTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingLeft: 10,
    marginBottom: 1,
  },
  bulletDot: {
    fontSize: 10,
    width: 10,
    lineHeight: 1.4,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
  },
  educationItem: {
    fontSize: 10,
    marginBottom: 2,
    paddingLeft: 10,
  },
  skillText: {
    fontSize: 10,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
})

// Replace characters outside Helvetica's charset so react-pdf doesn't substitute glyphs
function sanitizePDF(text: string): string {
  return text
    .replace(/₹/g, 'Rs.')   // rupee sign not in Helvetica
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, (c) => String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)))
    .replace(/[^\x00-\xFF]/g, '')  // drop anything outside Latin-1
}

function inlineBold(text: string) {
  return parseBold(sanitizePDF(text)).map((p, i) => (
    <Text key={i} style={p.bold ? s.bold : undefined}>{p.text}</Text>
  ))
}

const KW_STOP = new Set(['with', 'from', 'that', 'this', 'have', 'been', 'into', 'your', 'their', 'over', 'also', 'when', 'will', 'were', 'each', 'than', 'more', 'using', 'across', 'team', 'work', 'used', 'help', 'within'])

function inlineBoldKeywords(text: string, keywords: string[]) {
  if (!keywords.length) return inlineBold(text)
  const clean = sanitizePDF(text)
  // Match full phrases AND individual words (≥4 chars, non-stop) from multi-word keywords
  const tokens = new Set<string>()
  for (const kw of keywords) {
    tokens.add(kw)
    for (const word of kw.split(/\s+/)) {
      if (word.length >= 4 && !KW_STOP.has(word.toLowerCase())) tokens.add(word)
    }
  }
  // Longest first so full phrases take priority over individual words
  const sorted = [...tokens].sort((a, b) => b.length - a.length)
  const pattern = sorted.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const parts = clean.split(new RegExp(`(${pattern})`, 'gi'))
  return parts.map((part, i) => (
    <Text key={i} style={i % 2 === 1 ? s.bold : undefined}>{part}</Text>
  ))
}

export function ResumeDocument({ resumeJson, tailoredJson, compact, matchedKeywords }: Props) {

  const contact = [
    resumeJson.phone,
    resumeJson.email,
    resumeJson.location,
    resumeJson.linkedin,
  ].filter(Boolean).join(' | ')

  // Compact overrides applied via array styles
  const pageStyle = compact ? [s.page, { padding: 14, lineHeight: 1.25 }] : s.page
  const outerBoxStyle = compact ? [s.outerBox, { padding: 11 }] : s.outerBox
  const sectionHeaderStyle = compact ? [s.sectionHeader, { marginTop: 4, marginBottom: 3 }] : s.sectionHeader
  const bulletRowStyle = compact ? [s.bulletRow, { marginBottom: 0 }] : s.bulletRow
  const bulletDotStyle = compact ? s.bulletDot : s.bulletDot
  const bulletTextStyle = compact ? s.bulletText : s.bulletText
  const roleBlockStyle = compact ? { marginBottom: 2 } : { marginBottom: 4 }

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        <View style={outerBoxStyle}>

          {/* Header */}
          <Text style={compact ? [s.name, { marginBottom: 6 }] : s.name}>{resumeJson.name.toUpperCase()}</Text>
          <Text style={compact ? [s.contactLine, { marginBottom: 6 }] : s.contactLine}>{contact}</Text>

          {/* Executive Summary */}
          {tailoredJson.tailoredSummary && (
            <View>
              <Text style={sectionHeaderStyle}>EXECUTIVE SUMMARY</Text>
              <Text style={s.summaryText}>{inlineBold(tailoredJson.tailoredSummary)}</Text>
            </View>
          )}

          {/* Work Experience */}
          <View>
            <Text style={sectionHeaderStyle}>WORK EXPERIENCE</Text>
            {tailoredJson.tailoredExperience.map((exp, i) => (
              <View key={i} wrap={false} style={roleBlockStyle}>
                <Text style={s.roleTitle}>
                  {exp.title}, {exp.company} ({exp.startDate} – {exp.endDate})
                </Text>
                {exp.bullets.map((b, j) => {
                  const hasBold = b.includes('**')
                  return (
                    <View key={j} style={bulletRowStyle}>
                      <Text style={bulletDotStyle}>•</Text>
                      <Text style={bulletTextStyle}>
                        {!hasBold && matchedKeywords?.length
                          ? inlineBoldKeywords(b, matchedKeywords)
                          : inlineBold(b)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            ))}
          </View>

          {/* Education */}
          <View>
            <Text style={sectionHeaderStyle}>EDUCATION</Text>
            {resumeJson.education.map((ed, i) => (
              <Text key={i} style={s.educationItem}>
                • {ed.degree} | {ed.institution} ({ed.year})
              </Text>
            ))}
          </View>

          {/* Skills */}
          <View>
            <Text style={sectionHeaderStyle}>SKILLS</Text>
            <Text style={s.skillText}>{resumeJson.skills.join(', ')}</Text>
          </View>

        </View>
      </Page>
    </Document>
  )
}
