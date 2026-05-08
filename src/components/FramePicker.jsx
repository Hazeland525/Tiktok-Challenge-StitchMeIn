import { useState, useEffect } from 'react'
import { extractFilmstrip, extractFrame } from '../hooks/useVideoFrame'

export default function FramePicker({ videoEl, onConfirm, onClose }) {
  const [frames, setFrames]           = useState([])
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [selectedSrc, setSelectedSrc] = useState(null)
  const [loading, setLoading]         = useState(true)

  // Extract filmstrip on mount
  useEffect(() => {
    if (!videoEl) return
    videoEl.pause()

    extractFilmstrip(videoEl, 7).then(async (fs) => {
      setFrames(fs)
      const lastIdx = fs.length - 1
      setSelectedIdx(lastIdx)
      // Full-res version of the last (default) frame
      const full = await extractFrame(videoEl, fs[lastIdx].time, 1)
      setSelectedSrc(full)
      setLoading(false)
    })
  }, [videoEl])

  async function handleSelect(idx) {
    setSelectedIdx(idx)
    const full = await extractFrame(videoEl, frames[idx].time, 1)
    setSelectedSrc(full)
  }

  return (
    <div className="stitch-sheet">
      <div className="stitch-sheet__handle" />

      <div className="stitch-sheet__header">
        <button className="stitch-sheet__close" onClick={onClose}>✕</button>
        <h2 className="stitch-sheet__title">Pick your start frame</h2>
        <div style={{ width: 32 }} />
      </div>

      {loading ? (
        <p className="stitch-loading-text">Extracting frames…</p>
      ) : (
        <>
          {/* Selected frame preview */}
          {selectedSrc && (
            <div className="frame-preview">
              <img src={selectedSrc} className="frame-preview__img" alt="selected frame" />
            </div>
          )}

          {/* Filmstrip */}
          <div className="filmstrip">
            {frames.map((f, i) => (
              <button
                key={i}
                className={`filmstrip__frame${i === selectedIdx ? ' filmstrip__frame--active' : ''}`}
                onClick={() => handleSelect(i)}
              >
                <img src={f.src} alt={`frame ${i}`} />
              </button>
            ))}
          </div>

          <button
            className="stitch-cta"
            onClick={() => onConfirm(selectedSrc)}
            disabled={!selectedSrc}
          >
            Use this frame →
          </button>
        </>
      )}
    </div>
  )
}
