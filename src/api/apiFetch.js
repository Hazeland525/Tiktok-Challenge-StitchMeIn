const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

/**
 * Thin fetch wrapper that injects the demo passcode header on every
 * API request and fires 'auth:expired' on 401 so the passcode modal
 * can re-appear without the caller needing to know about it.
 */
export async function apiFetch(path, options = {}) {
  const passcode = localStorage.getItem('stitchmein_passcode') ?? ''
  const headers = {
    ...(options.headers ?? {}),
    'x-passcode': passcode,
  }

  const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('stitchmein_passcode')
    window.dispatchEvent(new Event('auth:expired'))
    throw new Error('Invalid or expired passcode')
  }

  return res
}
