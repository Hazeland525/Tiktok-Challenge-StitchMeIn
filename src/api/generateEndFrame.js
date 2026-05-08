/**
 * Calls the local Express proxy (/api/generate-stitch) which holds
 * the Gemini API key server-side — it never reaches the browser.
 *
 * lastFrameBase64  — the anchor frame from the user's clip selection
 * userPhotoBase64  — the user's selfie / uploaded photo
 * userPrompt       — the action description
 */
export async function generateEndFrame({ lastFrameBase64, userPhotoBase64, userPrompt }) {
  const res = await fetch('http://localhost:3001/api/generate-stitch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lastFrameBase64, userPhotoBase64, userPrompt }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error ?? `Server error ${res.status}`)
  }

  return `data:image/jpeg;base64,${data.imageBase64}`
}
