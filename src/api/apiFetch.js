const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const STORAGE_KEY = 'stitchmein_passcode'

function getPasscode() {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

/**
 * Fetch wrapper that injects x-passcode on every /api request.
 * Fires 'auth:expired' and throws on 401 so PasscodeModal re-appears.
 */
export async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.headers ?? {}),
    'x-passcode': getPasscode(),
  }

  const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new Event('auth:expired'))
    throw new Error('Invalid or expired passcode')
  }

  return res
}

/**
 * Builds a /api/video-proxy URL with the passcode as a query param.
 * Used for <video src> and <img src> where headers cannot be injected.
 * The server's requirePasscode() already checks req.query.passcode.
 */
export function apiProxyUrl(rawUri) {
  if (!rawUri) return null
  const passcode = getPasscode()
  const base = `${BACKEND_URL}/api/video-proxy?uri=${encodeURIComponent(rawUri)}`
  return passcode ? `${base}&passcode=${encodeURIComponent(passcode)}` : base
}
