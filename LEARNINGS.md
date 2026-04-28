# Tailor — Project Learnings & Technical Wiki

> Built April 2026. A zero-data CV tailoring utility for Senior Product Managers.
> Stack: Next.js 15 (App Router), React 19, Dexie.js, Google Gemini API, @react-pdf/renderer, Framer Motion.

---

## Table of Contents

1. [Product Architecture](#1-product-architecture)
2. [Google Gemini API](#2-google-gemini-api)
3. [Model Selection & Fallback Strategy](#3-model-selection--fallback-strategy)
4. [Streaming AI Responses](#4-streaming-ai-responses)
5. [Prompt Engineering](#5-prompt-engineering)
6. [IndexedDB with Dexie.js](#6-indexeddb-with-dexiejs)
7. [PDF Generation (Client-Side)](#7-pdf-generation-client-side)
8. [Session Management & Auto-Restore](#8-session-management--auto-restore)
9. [Rate Limiting Strategy](#9-rate-limiting-strategy)
10. [API Security](#10-api-security)
11. [Design System & Theme](#11-design-system--theme)
12. [Next.js App Router Patterns](#12-nextjs-app-router-patterns)
13. [State Machine Architecture](#13-state-machine-architecture)
14. [Cross-Component Communication](#14-cross-component-communication)
15. [Deployment & CI/CD](#15-deployment--cicd)
16. [Mistakes Made & Fixes](#16-mistakes-made--fixes)
17. [What Would Change in V2](#17-what-would-change-in-v2)

---

## 1. Product Architecture

### Zero-Data Principle
The entire product runs in the user's browser. No user database, no auth, no server-side storage. Every piece of user data — parsed CV, tailored output, session history — lives in **IndexedDB** via Dexie.js.

**Why this matters:**
- Eliminates GDPR liability for CV data
- No backend infrastructure cost
- Credible privacy claim: "Your data never leaves your browser"
- Works offline after first load

### Data Flow
```
PDF/DOCX upload
  → /api/parse-cv (text extraction + Gemini JSON mapping)
  → ResumeJSON stored in IndexedDB (cvHash key)
  → User pastes JD
  → /api/tailor-cv (Gemini streaming)
  → TailoredJSON stored in IndexedDB (jdHash key)
  → /api/score-cv (Gemini ATS scoring)
  → ATSScore stored with TailoredJSON
  → Results rendered (SniperView diff + PDF preview)
```

### Two API Calls Per Session
Parsing fires once per CV (cached by content hash). Tailoring fires once per unique JD (cached by JD hash). Same CV + same JD = zero additional API calls.

---

## 2. Google Gemini API

### Setup
```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' })
```

### Key: API key is server-side only
Never use `NEXT_PUBLIC_` prefix for the API key. It lives in `.env.local` and is only accessed inside `/api/*` route handlers. If prefixed with `NEXT_PUBLIC_`, the key is bundled into the client JavaScript and exposed to anyone.

### Free Tier Limits (as of April 2026)
| Model | RPM | RPD | Notes |
|---|---|---|---|
| gemini-3.1-flash-lite-preview | 15 | 500 | Best free tier, primary choice |
| gemini-2.5-flash | 15 | 500 | Good fallback |
| gemini-2.5-flash-lite | 10 | 250 | Final backup |
| gemini-2.5-pro | 5 | 25 | Too limited for free tier use |

**RPM** = Requests per minute, **RPD** = Requests per day

### Error Codes to Handle
- `429` — Rate limit hit (RPM or RPD). Check `errorDetails[].retryDelay` for how long to wait.
- `503` — Model overloaded. Fall back to next model immediately.
- Daily quota (`retryDelay > 60s`) — Do not retry, return user-friendly message.

### Retry Logic Pattern
```ts
function parseRetry(err): number | null {
  const details = err?.errorDetails
  if (Array.isArray(details)) {
    for (const d of details) {
      if (typeof d?.retryDelay === 'string') {
        const secs = parseFloat(d.retryDelay)
        if (secs > 60) return null   // daily quota — don't retry
        if (secs > 25) return null   // too long to block — don't retry
        return secs * 1000
      }
    }
  }
  return 4000  // default wait for unknown 429s
}
```

---

## 3. Model Selection & Fallback Strategy

### Three-Tier Fallback
Every API route uses primary → fallback → backup. Defined in `lib/models.ts`:

```ts
export const MODELS = {
  parsing: 'gemini-3.1-flash-lite-preview',
  parsingFallback: 'gemini-2.5-flash',
  parsingBackup: 'gemini-2.5-flash-lite',
  tailoring: 'gemini-3.1-flash-lite-preview',
  tailoringFallback: 'gemini-2.5-flash',
  tailoringBackup: 'gemini-2.5-flash-lite',
  scoring: 'gemini-3.1-flash-lite-preview',
  scoringFallback: 'gemini-2.5-flash',
  scoringBackup: 'gemini-2.5-flash-lite',
} as const
```

**Why a single models file:** Model names change. Centralising them means one edit updates all three routes. Never hardcode model strings in route files.

### Fallback Pattern (503 errors)
```ts
try {
  result = await tryWithModel(MODELS.primary)
} catch (err) {
  if (!is503(err)) throw err
  try {
    result = await tryWithModel(MODELS.fallback)
  } catch (fallbackErr) {
    if (!is503(fallbackErr)) throw fallbackErr
    result = await tryWithModel(MODELS.backup)
  }
}
```

### Dev Model Selector
In development, a floating "⚙ Models" panel lets you override models per-route via localStorage. The override is sent as `devModel` in the request body and only respected when `NODE_ENV !== 'production'`. This is how you test fallback behaviour without waiting for real quota errors.

### Models Tested and Rejected
- **Gemma 4 26B** — Echoed the prompt back instead of returning JSON. Not suitable for structured output tasks.
- **gemini-2.5-pro** — Only 25 RPD on free tier. Too limited for a public product.

---

## 4. Streaming AI Responses

### Why Stream
Users see bullets rewriting in real time. Without streaming, they'd stare at a spinner for 15-20 seconds. Streaming makes the wait feel productive.

### Server-Side: ReadableStream
```ts
const stream = new ReadableStream({
  async start(controller) {
    const result = await model.generateContentStream(prompt)
    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) controller.enqueue(encoder.encode(text))
    }
    controller.close()
  }
})
return new Response(stream, {
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
})
```

### Client-Side: Reading the Stream
```ts
const res = await fetch('/api/tailor-cv', { method: 'POST', body: JSON.stringify(payload) })
const reader = res.body!.getReader()
const decoder = new TextDecoder()
let fullText = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const chunk = decoder.decode(value, { stream: true })
  fullText += chunk
  setStreamedText(fullText)  // updates UI in real time
}
```

### Error Tokens in Stream
When an error occurs mid-stream (e.g. quota hit during generation), Gemini can't return an HTTP error — the response has already started. Use error sentinel tokens:

```ts
// Server emits:
controller.enqueue(encoder.encode('__ERROR__:quota_exhausted'))

// Client checks after stream ends:
if (fullText.includes('__ERROR__:quota_exhausted')) {
  showError('Tailoring quota reached for today.')
}
```

---

## 5. Prompt Engineering

### Key Rules for Structured JSON Output
1. Always say: "Return ONLY valid JSON — no markdown, no explanation, no code fences"
2. Show the exact JSON shape in the prompt
3. Use `extractJSON()` to strip any stray backticks before `JSON.parse()`
4. Always validate output with Zod before using it

### `extractJSON()` Utility
Models sometimes wrap JSON in markdown code fences despite instructions. Strip them:
```ts
export function extractJSON(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1) return raw.slice(firstBrace, lastBrace + 1)
  return raw.trim()
}
```

### Tailoring Prompt Learnings
- Explicitly say **"Include ALL bullets from every role — never drop any"** — otherwise the model omits bullets where it has nothing to change.
- Use **double asterisks** (`**term**`) for bolding in PDF output, with instruction: "Bold maximum 2–3 terms per bullet — be selective."
- Constrain bullet length: "Each rewritten bullet must not exceed 200 characters" — prevents overflow in PDF.
- Never ask for matchScore in the tailoring prompt. Do it in a separate scoring call — cleaner separation of concerns.

### Scoring Prompt Learnings
- Give a specific 100-point rubric (Hard Keywords 50pt, Job Scope 25pt, Recency 15pt, Qualifications 10pt) — vague prompts give inconsistent scores.
- Explicitly say "Soft skills carry zero weight" — otherwise leadership/communication inflate scores.
- Ask for `missingKeywords` with explicit constraint: "hard skill keywords only — technical tools, software, methodologies. Exclude all soft skills."
- `includeSuggestions` flag controls whether `placementSuggestions` are returned — skip them for the "original" score to save tokens.

### ATS Score Schema (Zod)
Always validate score responses. Models can hallucinate field names or return strings instead of numbers.

---

## 6. IndexedDB with Dexie.js

### Why Dexie
Dexie is the cleanest IndexedDB wrapper. It handles schema versioning, migrations, and gives a Promise-based API.

### Schema Design
```ts
class TailorDB extends Dexie {
  sessions!: Table<SessionRecord>
  resumeJson!: Table<ResumeJsonRecord>
  tailoredJson!: Table<TailoredJsonRecord>
  usageCounters!: Table<UsageCounter>
}
```

### Versioning — Critical Pattern
Every schema change requires a version bump. If you change the primary key of a table, you must clear old data:
```ts
this.version(2).stores({
  sessions: 'sessionId, cvHash, jdHash, updatedAt',
  // ...
}).upgrade(tx => tx.table('sessions').clear())
```
**Why:** Old records used UUID keys. New records use `${cvHash}_${jdHash}`. Without clearing, stale UUID-keyed records cause lookup failures.

### Composite Session Key
`sessionId = "${cvHash}_${jdHash}"` — this naturally deduplicates. Same CV + same JD always maps to the same record. Re-tailoring with the same inputs updates the record rather than creating a duplicate.

### cvHash — Hash Content, Not Filename
```ts
// Wrong — two different CVs with same name/size collide:
const cvHash = hashString(file.name + file.size)

// Right — hash the parsed content:
const cvHash = hashString(JSON.stringify(data.resumeJson))
```

### Querying
```ts
// Load 10 most recent sessions:
db.sessions.orderBy('updatedAt').reverse().limit(10).toArray()

// Get specific session:
db.sessions.get(`${cvHash}_${jdHash}`)

// Check cache before API call:
const existing = await db.tailoredJson.get(jdHash)
if (existing && existing.cvHash === cvHash) { /* use cache */ }
```

---

## 7. PDF Generation (Client-Side)

### Library: @react-pdf/renderer
Generates PDFs entirely in-browser using React components. No server, no Puppeteer.

### Key Patterns
```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// PDFViewer — renders live preview in browser
// PDFDownloadLink — download button
// pdf() — background generation (for overflow detection)
```

### Overflow Detection
To detect if content overflows to page 2 without showing the user a broken PDF:
```ts
async function checkOverflow(resumeJson, tailoredJson): Promise<boolean> {
  const blob = await pdf(
    <ResumeDocument resumeJson={resumeJson} tailoredJson={tailoredJson} compact={false} />
  ).toBlob()
  const buffer = await blob.arrayBuffer()
  const text = new TextDecoder().decode(buffer)
  const pageMatches = text.match(/\/Type\s*\/Page\b/g)
  return (pageMatches?.length ?? 1) > 1
}
```

### Compact Mode
`compact` is a prop passed to `ResumeDocument`. When `true`, font sizes and spacing are tightened to fit content on one page. Compact mode is **user-triggered** — only shown when overflow is detected, never auto-applied.

### Font Sizes That Work
- Name: 18pt
- Section headers: 11pt
- Bullet points, education, skills: 10pt
- Contact line: 10pt
- `marginBottom: 1` on bullet rows keeps them tight without looking cramped

### Non-Latin Character Handling
`@react-pdf/renderer` uses PDF Type 1 fonts by default and can't render certain Unicode characters (₹, smart quotes, etc.). Strip or replace them before rendering:
```ts
function sanitizePDF(text: string): string {
  return text
    .replace(/₹/g, 'Rs.')
    .replace(/[^\x00-\xFF]/g, '')  // drop non-Latin-1 chars
}
```

---

## 8. Session Management & Auto-Restore

### Problem
Users refresh the page and lose their place. A single-page app with client-side state doesn't survive a refresh.

### Solution: localStorage Restore Key
On every successful tailoring, save a pointer:
```ts
localStorage.setItem('tailor_restore', JSON.stringify({ cvHash, jdHash }))
```

On page load, check for this key and restore:
```ts
useEffect(() => {
  const restore = localStorage.getItem('tailor_restore')
  if (!restore) return
  const { cvHash, jdHash } = JSON.parse(restore)
  Promise.all([
    db.resumeJson.get(cvHash),
    db.tailoredJson.get(jdHash),
    db.sessions.get(`${cvHash}_${jdHash}`),
  ]).then(([resume, tailored, session]) => {
    if (!resume) return
    setResumeJson(resume.data)
    setCvHash(cvHash)
    if (session?.jdText) setJdText(session.jdText)
    if (tailored) { setTailoredJson(tailored.data); setStep('results') }
    else setStep('cv-preview')
  })
}, [])
```

### Clearing the Restore Key
When user clicks "Home" or logo, clear the key so they get a fresh landing:
```ts
localStorage.removeItem('tailor_restore')
window.dispatchEvent(new CustomEvent('tailor:go-home'))
```

---

## 9. Rate Limiting Strategy

### Architecture Decision
Server-side rate limiting (global + per-IP) is deferred to V2 using Upstash Redis. At P0, only client-side session limiting is active.

**Why deferred:** The monorepo had no KV infrastructure. Adding Upstash Redis at V2 requires one `npm install` and two env vars — no infra setup.

### Client-Side Session Limit
5 tailoring calls per browser session, tracked in IndexedDB `usageCounters` table, keyed by session ID (UUID, persists for the day):

```ts
export async function checkApiUsage(sessionId: string): Promise<ApiUsageStatus> {
  const today = new Date().toISOString().slice(0, 10)  // UTC date
  const record = await db.usageCounters.get(sessionId)
  const count = (record?.date === today) ? record.count : 0
  const remaining = SESSION_LIMIT - count
  if (remaining <= 0) return { status: 'session_blocked' }
  if (remaining <= 2) return { status: 'warning', remainingToday: remaining }
  return { status: 'ok', remainingToday: remaining }
}
```

### UX for Rate Limit States
- `ok` — subtle counter: "4 tailoring calls remaining today"
- `warning` — amber banner: "You have 2 tailoring calls left today"
- `session_blocked` — blocked button with message

### Refreshing the Counter
The rate limit bar must be refreshed explicitly — it doesn't auto-update when usage increments. Refresh it in two places:
1. After `incrementUsage()` fires (so bar updates as tailoring starts)
2. In the `tailor:go-home` event handler (so bar is accurate on landing page)

---

## 10. API Security

### Origin Guard
All API routes check the request origin in production to block direct abuse:

```ts
// lib/apiGuard.ts
function buildAllowedOrigins(): string[] {
  const origins = []
  if (process.env.NEXT_PUBLIC_SITE_URL) origins.push(process.env.NEXT_PUBLIC_SITE_URL)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  if (origins.length === 0) origins.push('https://tailor.vishalbuilds.com')
  return origins
}

export function isAllowedOrigin(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? ''
  return buildAllowedOrigins().some(allowed => origin.startsWith(allowed))
}
```

**Why `VERCEL_PROJECT_PRODUCTION_URL`:** Vercel auto-sets this to the stable project URL (`tailor-blue.vercel.app`). This means the app works on the Vercel URL without any env var config, and also on the custom domain once `NEXT_PUBLIC_SITE_URL` is set.

### Input Size Limits
Prevent prompt-stuffing attacks that would exhaust token quotas:
```ts
export const MAX_JD_CHARS = 30_000   // ~5,000 words
export const MAX_CV_CHARS = 50_000

if (jdText.length > MAX_JD_CHARS) return 400
```

### What's NOT Protected (V2 backlog)
- No per-IP rate limiting (requires Upstash Redis)
- No global daily cap (requires Upstash Redis)
- Origin check can be spoofed by a determined attacker — it's a deterrent, not a hard block
- CSRF tokens not implemented (low risk for a no-auth, no-cookie app)

### API Key Safety Checklist
- `.env.local` in `.gitignore` ✓
- `.env.local` excluded from `publish.js` copy ✓
- Never use `NEXT_PUBLIC_GEMINI_API_KEY` ✓
- Key only accessed in `/api/*` server routes ✓
- Log lines never print key or full CV data ✓

---

## 11. Design System & Theme

### CSS Custom Properties (Theme Tokens)
All colours are CSS variables toggled via `data-theme` attribute on `<html>`:
```css
:root { /* light */ --bg: #faf8f5; --accent: #10b981; --text-primary: #0f172a; }
[data-theme="dark"] { --bg: #020617; --accent: #10b981; --text-primary: #f1f5f9; }
```

### Theme Persistence
```ts
// ThemeProvider reads on mount, writes on change
const saved = localStorage.getItem('tailor-theme')
if (saved === 'light' || saved === 'dark') setTheme(saved)

// On change:
localStorage.setItem('tailor-theme', theme)
document.documentElement.setAttribute('data-theme', theme)
```

**Default:** Light mode. Previous versions defaulted to dark — changed based on product feel and mainstream convention.

### Typography Hierarchy
- DM Serif Display (Google Font) — headlines, `font-style: italic` for the "any job" tagline emphasis
- Geist Sans — all UI text
- Geist Mono — code/technical content

### Spacing Philosophy
No card grids. Typographic hierarchy + hairline dividers do the structural work. `panel` class gives subtle surface distinction without heavy boxing.

### Glassmorphism — Used Sparingly
Applied only to PDF preview pane and sniper diff view on desktop. Not applied to nav, session dashboard, or landing. Overuse makes UIs feel cheap.

### Mobile Rules
- Touch targets: minimum 44px height on all interactive elements
- Drop zone: hidden on mobile (tap-to-upload only)
- PDF preview: hidden on mobile, replaced with download button
- Nav: Home + Products links visible on mobile; "No data saved" shield hidden below 600px

---

## 12. Next.js App Router Patterns

### Server vs Client Components
- `app/layout.tsx` — server component, but imports client components (ThemeProvider, NavLogo)
- `app/page.tsx` — `'use client'` — entire page is client-side (IndexedDB, state machine)
- API routes (`app/api/**/route.ts`) — always server-side, never import client code

### `serverExternalPackages`
`pdf-parse` and `mammoth` use Node.js built-ins incompatible with the Edge runtime. Add to `next.config.js`:
```js
experimental: {
  serverExternalPackages: ['pdf-parse', 'mammoth']
}
```

### maxDuration on API Routes
```ts
export const maxDuration = 120  // seconds — Vercel function timeout
export const runtime = 'nodejs' // required for pdf-parse/mammoth
```

### `NEXT_PUBLIC_` Prefix Rule
Only use `NEXT_PUBLIC_` for env vars that must be readable in client-side code (browser). Never for secrets. The distinction is: `NEXT_PUBLIC_SITE_URL` (safe to expose — it's just a URL) vs `GEMINI_API_KEY` (never expose).

---

## 13. State Machine Architecture

### AppStep Type
```ts
type AppStep = 'landing' | 'parsing' | 'cv-preview' | 'jd-input' | 'tailoring' | 'results'
```

The entire app is a linear step machine managed by a single `step` state in `page.tsx`. Each step renders a different component via `AnimatePresence`. This is simpler than routing for a single-page flow.

### Why Not React Router / Next.js Routes
Every step shares state (resumeJson, tailoredJson, scores). Passing this via URL params or re-fetching from IndexedDB on each route change is unnecessary complexity. A single-component state machine is cleaner.

### Framer Motion `AnimatePresence`
```tsx
<AnimatePresence mode="wait">
  {step === 'landing' && <motion.div key="landing" ...>...</motion.div>}
  {step === 'results' && <motion.div key="results" ...>...</motion.div>}
</AnimatePresence>
```
`mode="wait"` ensures exit animation completes before the next step enters — avoids two steps rendering simultaneously.

---

## 14. Cross-Component Communication

### Problem: Same-Route Navigation
`<Link href="/">` on a Next.js App Router page where you're already on `/` doesn't remount the page component — it's a no-op. Clicking the logo would do nothing.

### Solution: Custom Events
```ts
// NavLogo / NavHomeLink — dispatch event
window.dispatchEvent(new CustomEvent('tailor:go-home'))

// page.tsx — listen for event
useEffect(() => {
  const handler = () => {
    setStep('landing')
    setResultNotice(null)
    refreshSessions()
    checkApiUsage(sessionId).then(setUsageStatus)
  }
  window.addEventListener('tailor:go-home', handler)
  return () => window.removeEventListener('tailor:go-home', handler)
}, [])
```

**When to use this pattern:** Any time a component outside the page (nav, layout) needs to trigger state changes inside the page, and prop drilling would require passing callbacks through `layout.tsx`.

---

## 15. Deployment & CI/CD

### Publish Script Pattern
`scripts/publish.js` copies the app to a separate git folder, excluding dev/sensitive files:
```js
const EXCLUDE = [
  'node_modules', '.next', '.env', '.env.local',
  'CV sample', 'CLAUDE.md', 'STATUS.md', 'gemini api.csv',
  'tsconfig.tsbuildinfo', '.git',
]
```

**Why a separate git folder:** The monorepo (`vishal-lab`) is a local development environment, not a deployable repo. Each product (tailor, investcalc, taxtool) has its own GitHub repo and Vercel project. The publish script is the bridge.

### Vercel Environment Variables
| Variable | When to set | Value |
|---|---|---|
| `GEMINI_API_KEY` | At first deploy | From Google AI Studio |
| `NEXT_PUBLIC_SITE_URL` | After custom domain is live | `https://tailor.vishalbuilds.com` |

### Origin Guard + Custom Domain Transition
1. Deploy to Vercel → `tailor-blue.vercel.app` — works via `VERCEL_PROJECT_PRODUCTION_URL`
2. Add custom domain → requests from `tailor.vishalbuilds.com` blocked until env var is set
3. Add `NEXT_PUBLIC_SITE_URL` → both URLs work simultaneously
4. Vercel redeploys automatically when env var is added

### Deploy Workflow
```bash
# 1. Make changes in vishal-lab/apps/tailor
node scripts/publish.js

# 2. Push from vishal-git/tailor
cd vishal-git/tailor
git add .
git commit -m "description"
git push
# Vercel auto-deploys
```

---

## 16. Mistakes Made & Fixes

### 1. cvHash from filename + filesize
**Problem:** Two different CVs named `resume.pdf` at the same size would get the same hash, overwriting each other in IndexedDB.
**Fix:** Hash the parsed JSON content instead: `hashString(JSON.stringify(resumeJson))`

### 2. Compact mode auto-applying
**Problem:** Auto-detecting overflow and silently switching to compact made fonts uncomfortably small without user awareness.
**Fix:** Show a button only when overflow is detected. User explicitly opts in to compact mode.

### 3. Session key as UUID
**Problem:** Each session got a new UUID, so re-tailoring the same CV + JD created duplicate records.
**Fix:** Session key = `${cvHash}_${jdHash}` — natural deduplication. Required a Dexie version bump with `upgrade()` to clear old UUID-keyed records.

### 4. Rate limit bar stale after tailoring
**Problem:** After tailoring and returning to the landing page, the bar still showed the old count until refresh.
**Fix:** Call `checkApiUsage()` in both the `tailor:go-home` event handler and immediately after `incrementUsage()`.

### 5. Gemma 4 26B echoing prompt
**Problem:** Open model echoed the full prompt back instead of returning JSON — not suitable for structured output.
**Fix:** Stick to Gemini models for structured JSON tasks. Open models need different prompting strategies.

### 6. Score-cv retry returning 500
**Problem:** 429 retry waited 8s but Google required 17s. Retry failed, fell through to 500 handler.
**Fix:** Parse the actual `retryDelay` from the error and honor it. Cap at 25s — don't retry if longer.

### 7. Logo click not resetting state
**Problem:** `<Link href="/">` on the same route is a no-op in Next.js App Router.
**Fix:** Replace with a client component button that dispatches a `tailor:go-home` custom event.

### 8. Non-Latin characters breaking PDF
**Problem:** ₹ symbol and curly quotes caused `@react-pdf/renderer` to render blank characters.
**Fix:** `sanitizePDF()` function replaces known problem characters before passing text to the PDF renderer.

### 9. JD text not restoring on session resume
**Problem:** `handleResume()` loaded CV and tailored data but didn't restore `jdText`, so "View JD" button didn't appear.
**Fix:** `setJdText(session.jdText ?? '')` in both `handleResume` and the auto-restore effect.

---

## 17. What Would Change in V2

### Server-Side Rate Limiting — Upstash Redis
```ts
// Per-IP daily limit
const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
const key = `tailor:ip:${hashIP(ip)}:${todayUTC()}`
const count = await redis.incr(key)
await redis.expire(key, 86400)
if (count > 5) return 429
```

### Inline CV Editing
Allow users to edit parsed ResumeJSON fields (fix parsing mistakes) before tailoring.

### Multiple Templates
Currently uses one PDF template. V2 could offer Amazon-style (STAR, metrics-dense) and Google-style (minimal, whitespace-generous) templates.

### Streaming Diff View
Instead of showing the full diff after tailoring completes, animate each bullet changing in real time as the stream arrives.

### Export to Word (.docx)
Many recruiters request DOCX. `docx` npm package can generate Word files client-side.

### Better cvHash
Use a SHA-256 hash via Web Crypto API for stronger deduplication:
```ts
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
```

### Session Limit Increase
Current: 5/session. V2 with Upstash: 5/IP/day + 30 global/day — more robust against abuse while being fair to real users.

---

*Last updated: April 2026 | Tailor v1.0*
