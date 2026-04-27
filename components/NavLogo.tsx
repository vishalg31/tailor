'use client'

export function NavLogo() {
  const handleClick = () => {
    localStorage.removeItem('tailor_restore')
    window.dispatchEvent(new CustomEvent('tailor:go-home'))
  }

  return (
    <button
      onClick={handleClick}
      style={{
        color: 'var(--text-primary)',
        textDecoration: 'none',
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: '-0.01em',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'inherit',
      }}
    >
      Tailor
      <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
        by Vishal Builds
      </span>
    </button>
  )
}
