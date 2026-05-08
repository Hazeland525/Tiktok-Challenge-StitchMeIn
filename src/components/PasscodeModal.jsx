import { useState, useEffect } from 'react'

const STORAGE_KEY  = 'stitchmein_passcode'
const BACKEND_URL  = import.meta.env.VITE_BACKEND_URL || ''

export default function PasscodeModal({ onUnlocked }) {
  const [visible,     setVisible]     = useState(false)
  const [value,       setValue]       = useState('')
  const [error,       setError]       = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [shaking,     setShaking]     = useState(false)

  // Show on mount if no passcode stored; re-show on auth:expired
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)

    function onExpired() {
      setValue('')
      setError(false)
      setVisible(true)
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  // Shake when error is set
  useEffect(() => {
    if (!error) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 400)
    return () => clearTimeout(t)
  }, [error])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    setSubmitting(true)

    try {
      const res = await fetch(`${BACKEND_URL}/api/ping`, {
        headers: { 'x-passcode': trimmed },
      })
      if (res.ok) {
        localStorage.setItem(STORAGE_KEY, trimmed)
        setVisible(false)
        setError(false)
        onUnlocked?.()
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (!visible) return null

  return (
    <div style={styles.backdrop}>
      <form
        style={{ ...styles.card, ...(shaking ? styles.shake : {}) }}
        onSubmit={handleSubmit}
      >
        <p style={styles.logo}>✦ StitchMeIn</p>
        <p style={styles.subtitle}>Enter the demo passcode to continue</p>
        <input
          style={styles.input}
          type="password"
          placeholder="Passcode"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false) }}
          autoFocus
          disabled={submitting}
        />
        {error && <p style={styles.error}>Incorrect passcode</p>}
        <button style={{ ...styles.btn, opacity: submitting ? 0.6 : 1 }} type="submit" disabled={submitting}>
          {submitting ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  backdrop: {
    position:       'fixed',
    inset:          0,
    zIndex:         99999,
    background:     '#000',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  },
  card: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           16,
    width:         '100%',
    maxWidth:      320,
    padding:       '40px 24px',
  },
  logo: {
    margin:        0,
    fontSize:      20,
    fontWeight:    700,
    color:         '#fff',
    fontFamily:    'system-ui, sans-serif',
    letterSpacing: 1,
  },
  subtitle: {
    margin:     0,
    fontSize:   14,
    color:      '#888',
    fontFamily: 'system-ui, sans-serif',
    textAlign:  'center',
  },
  input: {
    width:        '100%',
    boxSizing:    'border-box',
    padding:      '14px 16px',
    borderRadius: 10,
    border:       '1.5px solid #333',
    background:   '#111',
    color:        '#fff',
    fontSize:     16,
    fontFamily:   'system-ui, sans-serif',
    outline:      'none',
  },
  btn: {
    width:      '100%',
    padding:    '14px 0',
    borderRadius: 10,
    border:     'none',
    background: '#FE2C55',
    color:      '#fff',
    fontSize:   16,
    fontWeight: 700,
    fontFamily: 'system-ui, sans-serif',
    cursor:     'pointer',
  },
  error: {
    margin:     0,
    fontSize:   13,
    color:      '#FE2C55',
    fontFamily: 'system-ui, sans-serif',
  },
  shake: {},
}
