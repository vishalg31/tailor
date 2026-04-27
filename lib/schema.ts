import { z } from 'zod'

export const ResumeJSON = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullish(),
  location: z.string().nullish(),
  linkedin: z.string().nullish(),
  summary: z.string().nullish(),
  experience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    bullets: z.array(z.string()),
  })),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    year: z.string(),
  })),
  skills: z.array(z.string()),
  certifications: z.array(z.string()).nullish(),
})

export type ResumeJSONType = z.infer<typeof ResumeJSON>

export const TailoredJSON = z.object({
  tailoredExperience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    bullets: z.array(z.string()),
  })),
  tailoredSummary: z.string(),
})

export type TailoredJSONType = z.infer<typeof TailoredJSON>

const ATSBreakdownItem = z.object({
  score: z.number(),
  explanation: z.string(),
})

export const ATSScore = z.object({
  totalScore: z.number().int().min(0).max(100),
  scoreLabel: z.string(),
  breakdown: z.object({
    hardKeywords: ATSBreakdownItem,
    jobScope: ATSBreakdownItem,
    recency: ATSBreakdownItem,
    qualifications: ATSBreakdownItem,
  }),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  placementSuggestions: z.array(z.object({
    keyword: z.string(),
    suggestion: z.string(),
  })).optional(),
})

export type ATSScoreType = z.infer<typeof ATSScore>
