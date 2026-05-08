import { useState, useEffect, useRef, useCallback } from 'react'
import { extractFullFilmstrip, extractFrame } from '../hooks/useVideoFrame'

const WIN_FRAMES   = 8
const FRAME_W      = 24   // px per frame — bracket is 8×24=192px, centered in 402px
const BRACKET_LEFT = 48   // px from left of track to left edge of bracket (must match CSS)

export default function ClipSelector({ videoEl, pausedTime = 0, onConfirm, onClose }) {
  const [frames,        setFrames]        = useState([])
  const [previewSrc,    setPreviewSrc]    = useState(null)
  const [filmOffset,    setFilmOffset]    = useState(0)
  const [playheadFrame, setPlayheadFrame] = useState(WIN_FRAMES - 1)
  const [loading,       setLoading]       = useState(true)

  const framesRef         = useRef([])
  const filmOffsetRef     = useRef(0)
  const playheadFrameRef  = useRef(WIN_FRAMES - 1)
  const nRef              = useRef(0)
  const trackRef          = useRef(null)

  // filmstrip drag
  const isFilmDragging  = useRef(false)
  const filmDragStartX  = useRef(0)
  const filmDragStartOff = useRef(0)
  const filmRef         = useRef(null)

  // playhead drag
  const isPhDragging  = useRef(false)
  const playheadRef   = useRef(null)

  framesRef.current        = frames
  filmOffsetRef.current    = filmOffset
  playheadFrameRef.current = playheadFrame
  nRef.current             = frames.length

  useEffect(() => {
    if (!videoEl) return
    videoEl.pause()
    extractFullFilmstrip(videoEl, 16).then(async (fs) => {
      setFrames(fs)

      // Find frame closest to where the video was paused
      let closestIdx = 0
      let minDiff = Infinity
      fs.forEach((f, i) => {
        const diff = Math.abs(f.time - pausedTime)
        if (diff < minDiff) { minDiff = diff; closestIdx = i }
      })

      // Scroll filmstrip so the paused frame sits at the right edge of the bracket
      const leftIdx  = Math.max(0, closestIdx - (WIN_FRAMES - 1))
      const phFrame  = closestIdx - leftIdx   // 0 … WIN_FRAMES-1
      const rawOff   = -leftIdx * FRAME_W
      const clamped  = Math.max(-(fs.length - WIN_FRAMES) * FRAME_W, Math.min(0, rawOff))

      setFilmOffset(clamped)
      filmOffsetRef.current = clamped
      setPlayheadFrame(phFrame)
      playheadFrameRef.current = phFrame

      const full = await extractFrame(videoEl, fs[closestIdx].time, 1)
      setPreviewSrc(full)
      setLoading(false)
    })
  }, [videoEl])

  // ── helpers ──────────────────────────────────────────────
  function getWindow(offset, n) {
    const leftIdx  = Math.max(0, Math.round(-offset / FRAME_W))
    const rightIdx = Math.min(n - 1, leftIdx + WIN_FRAMES - 1)
    return { leftIdx, rightIdx }
  }

  function clampFilm(offset, n) {
    return Math.max(-(n - WIN_FRAMES) * FRAME_W, Math.min(0, offset))
  }

  function xToPhFrame(clientX) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return playheadFrameRef.current
    const relX = clientX - (rect.left + BRACKET_LEFT)
    return Math.max(0, Math.min(WIN_FRAMES - 1, Math.floor(relX / FRAME_W)))
  }

  // ── filmstrip drag ────────────────────────────────────────
  const onFilmMove = useCallback((e) => {
    if (!isFilmDragging.current) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clamped = clampFilm(filmDragStartOff.current + (clientX - filmDragStartX.current), nRef.current)
    filmOffsetRef.current = clamped
    setFilmOffset(clamped)
  }, [])

  const onFilmEnd = useCallback(async () => {
    if (!isFilmDragging.current) return
    isFilmDragging.current = false
    window.removeEventListener('mousemove', onFilmMove)
    window.removeEventListener('mouseup',   onFilmEnd)
    window.removeEventListener('touchmove', onFilmMove)
    window.removeEventListener('touchend',  onFilmEnd)

    const { leftIdx } = getWindow(filmOffsetRef.current, nRef.current)
    const absIdx = leftIdx + playheadFrameRef.current
    if (framesRef.current[absIdx]) {
      const full = await extractFrame(videoEl, framesRef.current[absIdx].time, 1)
      setPreviewSrc(full)
    }
  }, [videoEl, onFilmMove])

  const startFilmDrag = useCallback((e) => {
    e.preventDefault()
    console.log('%c👤 Dragging timeline', 'color:#FFBC28;font-weight:600')
    isFilmDragging.current   = true
    filmDragStartX.current   = e.touches ? e.touches[0].clientX : e.clientX
    filmDragStartOff.current = filmOffsetRef.current
    window.addEventListener('mousemove', onFilmMove)
    window.addEventListener('mouseup',   onFilmEnd)
    window.addEventListener('touchmove', onFilmMove, { passive: false })
    window.addEventListener('touchend',  onFilmEnd)
  }, [onFilmMove, onFilmEnd])

  // ── playhead drag ─────────────────────────────────────────
  const onPhMove = useCallback((e) => {
    if (!isPhDragging.current) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const f = xToPhFrame(clientX)
    playheadFrameRef.current = f
    setPlayheadFrame(f)
  }, [])

  const onPhEnd = useCallback(async (e) => {
    if (!isPhDragging.current) return
    isPhDragging.current = false
    window.removeEventListener('mousemove', onPhMove)
    window.removeEventListener('mouseup',   onPhEnd)
    window.removeEventListener('touchmove', onPhMove)
    window.removeEventListener('touchend',  onPhEnd)

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX
    const f = xToPhFrame(clientX)
    playheadFrameRef.current = f
    setPlayheadFrame(f)

    const { leftIdx } = getWindow(filmOffsetRef.current, nRef.current)
    const absIdx = leftIdx + f
    if (framesRef.current[absIdx]) {
      const full = await extractFrame(videoEl, framesRef.current[absIdx].time, 1)
      setPreviewSrc(full)
    }
  }, [videoEl, onPhMove])

  const startPhDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('%c👤 Dragging playhead', 'color:#FFBC28;font-weight:600')
    isPhDragging.current = true
    window.addEventListener('mousemove', onPhMove)
    window.addEventListener('mouseup',   onPhEnd)
    window.addEventListener('touchmove', onPhMove, { passive: false })
    window.addEventListener('touchend',  onPhEnd)
  }, [onPhMove, onPhEnd])

  // Attach touchstart as non-passive so preventDefault() actually works
  useEffect(() => {
    const film = filmRef.current
    const ph   = playheadRef.current
    film?.addEventListener('touchstart', startFilmDrag, { passive: false })
    ph?.addEventListener('touchstart',   startPhDrag,   { passive: false })
    return () => {
      film?.removeEventListener('touchstart', startFilmDrag)
      ph?.removeEventListener('touchstart',   startPhDrag)
    }
  }, [startFilmDrag, startPhDrag])

  // ── confirm ───────────────────────────────────────────────
  async function handleConfirm() {
    if (!previewSrc) return
    const { leftIdx, rightIdx } = getWindow(filmOffset, frames.length)
    onConfirm(previewSrc, {
      startTime: frames[leftIdx]?.time ?? 0,
      endTime:   frames[rightIdx]?.time ?? 0,
    })
  }

  const n = frames.length
  const { leftIdx, rightIdx } = n > 0
    ? getWindow(filmOffset, n)
    : { leftIdx: 0, rightIdx: 0 }

  // Playhead pixel position (center of selected frame cell, relative to track)
  const playheadLeft = BRACKET_LEFT + playheadFrame * FRAME_W + FRAME_W / 2

  return (
    <div className="clip-screen">
      {loading ? (
        <p className="stitch-loading-text">Extracting frames…</p>
      ) : (
        <>
          {/* Full-screen preview */}
          {previewSrc && (
            <div className="clip-preview">
              <img src={previewSrc} className="clip-preview__img" alt="selected moment" />
            </div>
          )}

          <button className="clip-screen__close" onClick={onClose}>✕</button>
          <button
            className="clip-screen__next"
            onClick={handleConfirm}
            disabled={!previewSrc}
          >Next</button>

          {/* Filmstrip track */}
          <div className="clip-filmstrip-track" ref={trackRef}>
            {/* Fixed bracket */}
            <div className="clip-selection-bracket" />

            {/* Draggable filmstrip */}
            <div
              ref={filmRef}
              className="clip-filmstrip"
              style={{ transform: `translateX(${filmOffset}px)` }}
              onMouseDown={startFilmDrag}
            >
              {frames.map((f, i) => {
                const inWin = i >= leftIdx && i <= rightIdx
                return (
                  <div key={i} className="clip-frame">
                    <img src={f.src} alt={`frame ${i}`} />
                    {!inWin && <div className="clip-frame__dim" />}
                  </div>
                )
              })}
            </div>

            {/* Draggable playhead — constrained within bracket */}
            <div
              ref={playheadRef}
              className="clip-playhead clip-playhead--draggable"
              style={{ left: `${playheadLeft}px` }}
              onMouseDown={startPhDrag}
            />
          </div>

          {/* Duration label */}
          <div className="clip-duration-label">
            <span className="clip-duration-text">5.0s selected</span>
          </div>
        </>
      )}
    </div>
  )
}
