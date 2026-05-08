import { useState, useCallback } from 'react'
import Feed          from './components/Feed'
import StitchFlow    from './components/StitchFlow'
import PasscodeModal from './components/PasscodeModal'
import './components/components.css'

export default function App() {
  const [cursor,          setCursor]          = useState({ x: -100, y: -100 })
  const [pressed,         setPressed]         = useState(false)
  const [stitchTarget,    setStitchTarget]    = useState(null)
  const [generatedPosts,  setGeneratedPosts]  = useState([])
  const [mockBanner,      setMockBanner]      = useState(false)

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
    if (clipContext.usedMockMode) setMockBanner(true)
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

      <PasscodeModal />

      {mockBanner && (
        <div style={bannerStyle}>
          <span>Demo limit reached — showing placeholder results</span>
          <button onClick={() => setMockBanner(false)} style={bannerCloseStyle}>✕</button>
        </div>
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

const bannerStyle = {
  position:       'fixed',
  top:            0,
  left:           '50%',
  transform:      'translateX(-50%)',
  zIndex:         9000,
  width:          '100%',
  maxWidth:       390,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  gap:            8,
  padding:        '10px 16px',
  background:     '#1a1a1a',
  borderBottom:   '1px solid #333',
  color:          '#fff',
  fontSize:       13,
  fontFamily:     'system-ui, sans-serif',
  boxSizing:      'border-box',
}

const bannerCloseStyle = {
  background: 'none',
  border:     'none',
  color:      '#888',
  fontSize:   16,
  cursor:     'pointer',
  flexShrink: 0,
  padding:    0,
}
