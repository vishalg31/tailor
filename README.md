# Tailor

**ATS-ready CV in 60 seconds.**

Paste a job description. Get a tailored, ATS-optimised CV with rewritten bullets, a match score, and a one-click PDF export. Your data never leaves your browser.

## Features

- **ATS scoring** — simulates enterprise ATS engines (Workday, Greenhouse, Lever) with a 100-point rubric across keyword match, job scope, recency, and qualifications
- **Word-level diff** — side-by-side before/after view with highlighted changes at word level
- **Streaming tailoring** — bullets rewrite in real time as the AI generates them
- **PDF export** — one-click download with auto compact mode if content overflows to a second page
- **Session dashboard** — rename, delete, resume, and export past sessions; same CV + JD never re-fires the API
- **Zero data stored** — everything lives in IndexedDB in the user's browser; nothing hits a server database
- **Import / export** — export parsed CV as JSON and re-import on any device

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [Dexie.js](https://dexie.org/) — IndexedDB wrapper for client-side persistence
- [Google Gemini](https://aistudio.google.com/) — parsing, tailoring (streaming), and ATS scoring
- [@react-pdf/renderer](https://react-pdf.org/) — client-side PDF generation
- [Framer Motion](https://www.framer.com/motion/) — step transitions
- [DM Serif Display](https://fonts.google.com/specimen/DM+Serif+Display) + [Geist](https://fonts.google.com/specimen/Geist)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create a `.env.local` file (see `.env.local.example`):

```
GEMINI_API_KEY=your_key_here
```

Get a free key at [aistudio.google.com](https://aistudio.google.com).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| `NEXT_PUBLIC_SITE_URL` | Production | Your custom domain (e.g. `https://tailor.vishalbuilds.com`) — add after custom domain is live in Vercel |

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add `GEMINI_API_KEY` in **Settings → Environment Variables**
4. Deploy — app is live on the Vercel URL immediately
5. Once a custom domain is configured, add `NEXT_PUBLIC_SITE_URL=https://your-domain.com`

## Disclaimer

CV processing uses Google AI Studio free tier. Prompts may be used by Google to improve their models per their terms of service. No CV data is stored on Tailor's servers.
