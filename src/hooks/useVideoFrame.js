/**
 * Seek the video to a specific time and resolve when ready.
 */
function seekTo(videoEl, time) {
  return new Promise((resolve) => {
    const clamped = Math.max(0, Math.min(time, (videoEl.duration || 10) - 0.05))
    if (Math.abs(videoEl.currentTime - clamped) < 0.02) {
      resolve()
      return
    }
    const onSeeked = () => {
      videoEl.removeEventListener('seeked', onSeeked)
      resolve()
    }
    videoEl.addEventListener('seeked', onSeeked)
    videoEl.currentTime = clamped
  })
}

/**
 * Extract a single frame at `time` seconds.
 * Returns a base64 JPEG data URL.
 * scale=1 → full video resolution, scale<1 → smaller (for thumbnails)
 */
export async function extractFrame(videoEl, time, scale = 1) {
  if (!videoEl) return null
  await seekTo(videoEl, time)
  const w = Math.round((videoEl.videoWidth  || 390) * scale)
  const h = Math.round((videoEl.videoHeight || 844) * scale)
  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  canvas.getContext('2d').drawImage(videoEl, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', scale < 1 ? 0.7 : 0.9)
}

/**
 * Extract `count` evenly-spaced frames from the last 3 seconds
 * of the video as small thumbnails for the filmstrip.
 */
export async function extractFilmstrip(videoEl, count = 7) {
  if (!videoEl) return []
  const duration = videoEl.duration || 10
  const start    = Math.max(0, duration - 3)
  const end      = duration - 0.05
  const step     = count > 1 ? (end - start) / (count - 1) : 0

  const frames = []
  for (let i = 0; i < count; i++) {
    const time = start + i * step
    const src  = await extractFrame(videoEl, time, 0.35) // small for filmstrip
    frames.push({ time, src })
  }
  return frames
}

/**
 * Extract `count` evenly-spaced frames across the full video duration.
 * Returns array of { time, src } objects with small thumbnail images.
 */
export async function extractFullFilmstrip(videoEl, count = 16) {
  if (!videoEl) return []
  const duration = videoEl.duration || 10
  const frames = []
  for (let i = 0; i < count; i++) {
    const time = (count === 1) ? 0 : (i / (count - 1)) * Math.max(0, duration - 0.05)
    const src  = await extractFrame(videoEl, time, 0.3)
    frames.push({ time, src })
  }
  return frames
}
