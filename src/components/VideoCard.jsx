import { useRef, useEffect, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { apiProxyUrl } from '../api/apiFetch'
import './components.css'

export default function VideoCard({ video, index, isActive, paused, stitchOpen, onStitchIn }) {
  const videoRef = useRef(null)
  const sourceVideoRef = useRef(null)
  const aiVideoRef = useRef(null)
  const audioRef = useRef(null) // BGM for generated posts
  const [liked, setLiked] = useState(false)
  const [likeKey, setLikeKey] = useState(0)
  const [bookmarked, setBookmarked] = useState(false)
  const [stitchAnimating, setStitchAnimating] = useState(false)
  const [genImgVisible, setGenImgVisible] = useState(false)
  const [showAiSegment, setShowAiSegment] = useState(false)

  const sourceVideoUrl = video.sourceVideoUrl ?? video.videoSrc ?? null
  const generatedVideoUrl = video.generatedVideoUrl ?? null
  const proxiedGeneratedVideoUrl = apiProxyUrl(generatedVideoUrl)

  // Regular video playback
  useEffect(() => {
    if (video.isGenerated) return
    const el = videoRef.current
    if (!el) return

    if (isActive && !paused && !stitchOpen) {
      el.play().catch(() => {})
    } else {
      el.pause()
      if (!isActive) el.currentTime = 0
    }
  }, [isActive, paused, stitchOpen, video.isGenerated])

  // Generated stitched post: loop source clip -> AI video
  useEffect(() => {
    if (!video.isGenerated) return

    const sourceEl = sourceVideoRef.current
    const aiEl = aiVideoRef.current
    const bgm = audioRef.current

    if (!isActive || paused || stitchOpen) {
      sourceEl?.pause()
      aiEl?.pause()
      bgm?.pause()
      if (!isActive) {
        setShowAiSegment(false)
        setGenImgVisible(false)
        if (sourceEl) sourceEl.currentTime = video.clipStart ?? 0
        if (aiEl) aiEl.currentTime = 0
      }
      return
    }

    if (bgm) {
      bgm.volume = 1
      bgm.currentTime = 0
      bgm.play().catch(() => {})
    }

    // Preferred stitched playback: source clip hands over directly to generated video.
    if (video.isStitched && sourceEl && aiEl && sourceVideoUrl && proxiedGeneratedVideoUrl) {
      const clipStart = video.clipStart ?? 0
      const clipEnd = video.clipEnd ?? null

      setShowAiSegment(false)
      sourceEl.currentTime = clipStart
      aiEl.currentTime = 0
      sourceEl.play().catch(() => {})

      const handoverToAi = () => {
        sourceEl.pause()
        setShowAiSegment(true)
        aiEl.currentTime = 0
        aiEl.play().catch(() => {})
      }

      const restartSequence = () => {
        aiEl.pause()
        setShowAiSegment(false)
        sourceEl.currentTime = clipStart
        sourceEl.play().catch(() => {})
      }

      const onSourceTimeUpdate = () => {
        if (clipEnd != null && sourceEl.currentTime >= clipEnd) {
          handoverToAi()
        }
      }

      sourceEl.addEventListener('timeupdate', onSourceTimeUpdate)
      sourceEl.addEventListener('ended', handoverToAi)
      aiEl.addEventListener('ended', restartSequence)

      return () => {
        sourceEl.removeEventListener('timeupdate', onSourceTimeUpdate)
        sourceEl.removeEventListener('ended', handoverToAi)
        aiEl.removeEventListener('ended', restartSequence)
      }
    }

    // Fallback generated post: source clip -> static AI image
    if (sourceEl) {
      setGenImgVisible(false)
      sourceEl.currentTime = video.clipStart ?? 0
      sourceEl.play().catch(() => {})

      const onTimeUpdate = () => {
        if (video.clipEnd != null && sourceEl.currentTime >= video.clipEnd) {
          sourceEl.pause()
          setGenImgVisible(true)
        }
      }

      sourceEl.addEventListener('timeupdate', onTimeUpdate)
      return () => sourceEl.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [isActive, paused, stitchOpen, video, sourceVideoUrl, proxiedGeneratedVideoUrl])

  function handleStitch() {
    console.log('%c👤 Tapped "Stitch Me In" on ' + (video.user ?? 'video'), 'color:#FFBC28;font-weight:600')
    setStitchAnimating(true)
    setTimeout(() => setStitchAnimating(false), 600)
    onStitchIn?.(videoRef.current)
  }

  return (
    <div className="video-card">
      {video.isGenerated ? (
        <>
          <audio ref={audioRef} src={video.soundtrack ?? '/audio/jungle_jungle.mp3'} loop preload="auto" />

          {video.isStitched && sourceVideoUrl && proxiedGeneratedVideoUrl ? (
            <>
              <video
                ref={sourceVideoRef}
                className="video-el"
                src={sourceVideoUrl}
                playsInline
                muted
                style={{ opacity: showAiSegment ? 0 : 1 }}
              />
              <video
                ref={aiVideoRef}
                className="video-el"
                src={proxiedGeneratedVideoUrl}
                playsInline
                muted
                style={{ opacity: showAiSegment ? 1 : 0 }}
              />
            </>
          ) : (
            <>
              {sourceVideoUrl ? (
                <video
                  ref={sourceVideoRef}
                  className="video-el"
                  src={sourceVideoUrl}
                  playsInline
                  muted
                />
              ) : (
                <div className="video-el" style={{ background: '#000' }} />
              )}
              <img
                src={video.generatedSrc}
                className={`preview-generated ${genImgVisible ? 'preview-generated--visible preview-generated--animate' : ''}`}
                alt="your moment"
              />
            </>
          )}
        </>
      ) : (
        <video
          ref={videoRef}
          className="video-el"
          src={video.src}
          loop
          playsInline
        />
      )}

      {paused && !video.isGenerated && (
        <div className="play-overlay">
          <img src="/icons/play.svg" className="play-overlay__icon" />
        </div>
      )}

      {/* Centered Stitch Me In button — only when paused and stitch not open */}
      {isActive && paused && !stitchOpen && !video.isGenerated && (
        <div className="stitch-center-wrap" onMouseDown={(e) => e.stopPropagation()}>
          <button
            className="stitch-center-btn"
            onClick={handleStitch}
            style={{ transform: stitchAnimating ? 'scale(0.95)' : 'scale(1)' }}
          >
            <img src="/icons/stitch.svg" alt="" style={{ width: 18, height: 18, marginRight: 8, flexShrink: 0 }} />
            Stitch Me
          </button>
        </div>
      )}

      <div className="bottom-gradient" />

      {/* Sidebar — stopPropagation prevents triggering feed drag */}
      <div className="sidebar" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sidebar__avatar-wrap">
          <div className="sidebar__avatar">
            {video.avatar
              ? <img src={video.avatar} className="sidebar__avatar-img" alt="" />
              : <span className="sidebar__avatar-emoji">🙋</span>
            }
          </div>
          {!video.isGenerated && (
            <div className="sidebar__follow-pip">
              <span>+</span>
            </div>
          )}
        </div>

        <SidebarAction
          icon={<HeartIcon filled={liked} animKey={likeKey} />}
          label={video.likes}
          onClick={() => { setLiked((l) => !l); setLikeKey((k) => k + 1) }}
          labelColor={liked ? '#FE2C55' : '#fff'}
        />

        <SidebarAction icon={<CommentIcon />} label={video.comments} />

        <SidebarAction
          icon={<BookmarkIcon filled={bookmarked} />}
          label="Save"
          onClick={() => setBookmarked((b) => !b)}
        />

        <SidebarAction icon={<ShareIcon />} label="Share" />

        <SpinningDisc index={index} isActive={isActive} />
      </div>

      <div className="caption">
        <p className="caption__username">{video.user}</p>
        <p className="caption__text">{video.caption}</p>
        <div className="caption__music-row">
          <img src="/icons/music.svg" width={13} height={13} alt="" />
          <span className="caption__music-text">{video.isGenerated ? 'Jungle Jungle' : `original sound · ${video.user}`}</span>
        </div>
      </div>
    </div>
  )
}

function SidebarAction({ icon, label, onClick, labelColor = '#fff' }) {
  return (
    <button className="sidebar-action" onClick={onClick}>
      {icon}
      <span className="sidebar-action__label" style={{ color: labelColor }}>
        {label}
      </span>
    </button>
  )
}

function HeartIcon({ filled, animKey }) {
  return (
    <svg
      key={animKey}
      width="28" height="28" viewBox="0 0 24 24"
      fill={filled ? '#FE2C55' : 'white'}
      stroke={filled ? 'none' : 'white'}
      strokeWidth={filled ? 0 : 0.5}
      className={filled ? 'heart-liked' : ''}
      style={{ display: 'block' }}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6.07 6.07 0 0116.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function CommentIcon() {
  return <img src="/icons/comment.svg" width={28} height={28} alt="" />
}

function BookmarkIcon({ filled }) {
  const controls = useAnimation()
  const prevFilled = useRef(false)

  useEffect(() => {
    if (filled && !prevFilled.current) {
      controls.start({
        scale: [1, 0.65, 1.25, 1],
        transition: { duration: 0.45, type: 'spring', stiffness: 400, damping: 12 },
      })
    }
    prevFilled.current = filled
  }, [filled, controls])

  return (
    <motion.div animate={controls} style={{ display: 'flex', alignItems: 'center' }}>
      <img
        src="/icons/save.svg"
        width={28}
        height={28}
        alt=""
        style={{ filter: filled ? 'brightness(0) saturate(100%) invert(80%) sepia(80%) saturate(800%) hue-rotate(5deg) brightness(105%)' : 'none' }}
      />
    </motion.div>
  )
}

function ShareIcon() {
  return <img src="/icons/share.svg" width={28} height={28} alt="" />
}

function SpinningDisc({ index, isActive }) {
  const [rotation, setRotation] = useState(0)
  const rafRef = useRef(null)
  const lastRef = useRef(null)
  const emojis = ['🐾', '🍽️', '🌅']

  useEffect(() => {
    if (isActive) {
      const spin = (ts) => {
        if (lastRef.current !== null) {
          setRotation((r) => r + (ts - lastRef.current) * 0.04)
        }
        lastRef.current = ts
        rafRef.current = requestAnimationFrame(spin)
      }
      rafRef.current = requestAnimationFrame(spin)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastRef.current = null
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isActive])

  return (
    <div className="spinning-disc" style={{ transform: `rotate(${rotation}deg)` }}>
      <div className="spinning-disc__inner">
        {emojis[index % emojis.length]}
      </div>
    </div>
  )
}
