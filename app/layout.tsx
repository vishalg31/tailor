import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Gelasio } from 'next/font/google'

const gelasio = Gelasio({
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
})
import { Analytics } from '@vercel/analytics/react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { DevModelPanel } from '@/components/DevModelPanel'
import { NavBar } from '@/components/NavBar'
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
    <html lang="en" data-theme="light" className={`${GeistSans.variable} ${GeistMono.variable} ${gelasio.variable}`}>
      <body>
        <ThemeProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <NavBar />

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
              <p style={{ marginTop: 4 }}>Powered by Google AI Studio. Your CV is never stored on our servers.</p>
            </footer>
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

