'use client'

import { useEffect, useRef, useState } from 'react'
import { NavLogo, NavHomeLink } from '@/components/NavLogo'
import { ThemeToggle } from '@/components/ThemeToggle'

export function NavBar() {
  const [visible, setVisible] = useState(true)
  const lastY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (y < 60) {
        setVisible(true)
      } else if (y > lastY.current) {
        setVisible(false)
      } else {
        setVisible(true)
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      transform: visible ? 'translateY(0)' : 'translateY(-100%)',
      transition: 'transform 0.25s ease',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
    }}>
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
            <NavHomeLink />
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
    </header>
  )
}
