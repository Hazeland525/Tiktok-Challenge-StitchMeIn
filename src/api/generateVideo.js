import { apiFetch } from './apiFetch'

export async function generateVideo({ generatedImageDataUrl, lastFrameBase64, userPrompt }) {
  const res = await apiFetch('/api/generate-video', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      generatedImageBase64: generatedImageDataUrl,
      lastFrameBase64,
      userPrompt,
    }),
  })

  const raw = await res.text()
  let data = {}
  if (raw) {
    try { data = JSON.parse(raw) } catch {
      throw new Error(`Server returned non-JSON response (${res.status})`)
    }
  }

  if (!res.ok) {
    throw new Error(data.error ?? `Server error ${res.status}`)
  }

  return {
    videoUri:     data.videoUri,
    usedMockMode: data.usedMockMode ?? false,
  }
}
