import { useState, useCallback } from 'react'
import Feed        from './components/Feed'
import StitchFlow  from './components/StitchFlow'
import './components/components.css'

export default function App() {
  const [cursor,          setCursor]          = useState({ x: -100, y: -100 })
  const [pressed,         setPressed]         = useState(false)
  const [stitchTarget,    setStitchTarget]    = useState(null) // { videoEl, video, index }
  const [generatedPosts,  setGeneratedPosts]  = useState([])

  const onMouseMove = useCallback((e) => setCursor({ x: e.clientX, y: e.clientY }), [])
  const onMouseDown = useCallback(() => setPressed(true),  [])
  const onMouseUp   = useCallback(() => setPressed(false), [])

  function handleStitchIn(videoEl, video, index) {
    const pausedTime = videoEl?.currentTime ?? 0
    videoEl?.pause()
    setStitchTarget({ videoEl, video, index, pausedTime })
  }

  function handleStitchClose() {
    setStitchTarget(null)
  }

  function handlePost(imageUrl, caption, clipContext = {}) {
    const sourceVideoUrl    = clipContext.sourceVideoUrl ?? clipContext.videoSrc ?? null
    const generatedVideoUrl = clipContext.generatedVideoUrl ?? null
    const newPost = {
      id:             Date.now(),
      isGenerated:    true,
      isStitched:     Boolean(sourceVideoUrl && generatedVideoUrl),
      generatedSrc:   imageUrl,
      // Composite stitched object for feed playback
      sourceVideoUrl,
      generatedVideoUrl,
      videoSrc:       sourceVideoUrl,
      clipStart:      clipContext.clipStart  ?? 0,
      clipEnd:        clipContext.clipEnd    ?? null,
      engineUsed:     clipContext.engineUsed ?? null,
      soundtrack:     '/audio/jungle_jungle.mp3',
      avatar:         '/images/profile5.png',
      user:           '@you',
      caption:        caption || '✦ Stitched myself in',
      likes:          '0',
      comments:       '0',
    }
    setGeneratedPosts((prev) => [newPost, ...prev])
    setStitchTarget(null)
  }

  const stitchOpen = !!stitchTarget

  return (
    <div
      className="app-container"
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      <Feed
        onStitchIn={handleStitchIn}
        stitchOpen={stitchOpen}
        generatedPosts={generatedPosts}
      />

      {stitchTarget && (
        <StitchFlow
          videoEl={stitchTarget.videoEl}
          video={stitchTarget.video}
          videoIndex={stitchTarget.index}
          pausedTime={stitchTarget.pausedTime}
          onClose={handleStitchClose}
          onPost={handlePost}
        />
      )}

      {/* Custom cursor */}
      <div
        className="custom-cursor"
        style={{
          left:       cursor.x,
          top:        cursor.y,
          background: pressed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)',
        }}
      />
    </div>
  )
}
