import { apiFetch } from './apiFetch'

export async function generateEndFrame({ lastFrameBase64, userPhotoBase64, userPrompt }) {
  const res = await apiFetch('/api/generate-stitch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lastFrameBase64, userPhotoBase64, userPrompt }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error ?? `Server error ${res.status}`)
  }

  return {
    imageDataUrl:  `data:image/jpeg;base64,${data.imageBase64}`,
    usedMockMode:  data.usedMockMode ?? false,
  }
}
