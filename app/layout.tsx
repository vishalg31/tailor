import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { DM_Serif_Display } from 'next/font/google'

const dmSerif = DM_Serif_Display({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
})
import { Analytics } from '@vercel/analytics/react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DevModelPanel } from '@/components/DevModelPanel'
import { NavLogo } from '@/components/NavLogo'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tailor | ATS-ready CV in 60 seconds',
  description: 'A perfectly tailored, ATS-ready resume in 60 seconds. Your data never leaves your browser.',
  metadataBase: new URL('https://tailor.vishalbuilds.com'),
  openGraph: {
    title: 'Tailor | ATS-ready CV in 60 seconds',
    description: 'Paste a job description. Get an ATS-optimised CV tailored to the role. Your data never leaves your browser.',
    url: 'https://tailor.vishalbuilds.com',
    siteName: 'Tailor',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${GeistSans.variable} ${GeistMono.variable} ${dmSerif.variable}`}>
      <body>
        <ThemeProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Nav */}
            <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{
                maxWidth: 920,
                margin: '0 auto',
                padding: '0 20px',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <NavLogo />

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <nav className="site-nav" aria-label="Site navigation">
                    <a href="https://www.vishalbuilds.com/">Home</a>
                    <a href="https://www.vishalbuilds.com/#projects">Products</a>
                  </nav>
                  <span className="nav-shield nav-desktop">
                    <svg width="9" height="11" viewBox="0 0 10 12" fill="none">
                      <path d="M5 0L0 2.18v3.27C0 8.49 2.13 11.28 5 12c2.87-.72 5-3.51 5-6.55V2.18L5 0z" fill="currentColor" opacity="0.45" />
                    </svg>
                    No data saved
                  </span>
                  <ThemeToggle />
                </div>
              </div>
            </nav>

            {/* Page content */}
            <main style={{ flex: 1 }}>{children}</main>

            {/* Dev model selector — floating, local only */}
            {process.env.NODE_ENV === 'development' && (
              <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 200 }}>
                <DevModelPanel />
              </div>
            )}

            {/* Footer */}
            <footer className="site-footer">
              <p className="site-footer-credit">Made by Vishal.</p>
              <p>
                <a href="https://vishalbuilds.com" target="_blank" rel="noreferrer">Website</a>
                {' · '}
                <a href="https://about.vishalbuilds.com/" target="_blank" rel="noreferrer">About</a>
                {' · '}
                <a href="mailto:vgvishal31@gmail.com">Email</a>
              </p>
              <p style={{ marginTop: 4 }}>CV processing uses Google AI Studio free tier. Prompts may be used by Google to improve their models.</p>
            </footer>
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

