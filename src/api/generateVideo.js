/**
 * Calls /api/generate-video on the Express proxy.
 * Takes the Gemini-generated image and a motion prompt,
 * submits a Veo image-to-video job, polls until done,
 * and resolves with a temporary GCS video URI.
 *
 * generatedImageDataUrl — data URL string from generateEndFrame()
 * lastFrameBase64       — last frame from the original user-selected clip
 * userPrompt            — the original action description
 */
export async function generateVideo({
  generatedImageDataUrl,
  lastFrameBase64,
  userPrompt,
}) {
  // Veo can take several minutes — no artificial timeout here
  const res = await fetch('http://localhost:3001/api/generate-video', {
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
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error(`Server returned non-JSON response (${res.status})`)
    }
  }

  if (!res.ok) {
    throw new Error(data.error ?? `Server error ${res.status}`)
  }

  return data.videoUri // temporary GCS HTTPS URL
}
