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
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  contactLine: {
    fontSize: 10,
    marginBottom: 10,
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

export function ResumeDocument({ resumeJson, tailoredJson, compact }: Props) {

  const contact = [
    resumeJson.phone,
    resumeJson.email,
    resumeJson.location,
    resumeJson.linkedin,
  ].filter(Boolean).join(' | ')

  // Compact overrides applied via array styles
  const pageStyle = compact ? [s.page, { fontSize: 9, padding: 14 }] : s.page
  const outerBoxStyle = compact ? [s.outerBox, { padding: 12 }] : s.outerBox
  const sectionHeaderStyle = compact ? [s.sectionHeader, { marginTop: 7, fontSize: 9 }] : s.sectionHeader
  const bulletRowStyle = compact ? [s.bulletRow, { marginBottom: 1 }] : s.bulletRow
  const bulletDotStyle = compact ? [s.bulletDot, { fontSize: 9 }] : s.bulletDot
  const bulletTextStyle = compact ? [s.bulletText, { fontSize: 9 }] : s.bulletText
  const roleBlockStyle = compact ? { marginBottom: 4 } : { marginBottom: 6 }

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        <View style={outerBoxStyle}>

          {/* Header */}
          <Text style={s.name}>{resumeJson.name.toUpperCase()}</Text>
          <Text style={s.contactLine}>{contact}</Text>

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
                {exp.bullets.map((b, j) => (
                  <View key={j} style={bulletRowStyle}>
                    <Text style={bulletDotStyle}>•</Text>
                    <Text style={bulletTextStyle}>{inlineBold(b)}</Text>
                  </View>
                ))}
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
