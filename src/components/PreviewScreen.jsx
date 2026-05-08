import { useState, useRef, useEffect } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const CROSSFADE_DELAY_MS = 100

export default function PreviewScreen({ video, generatedResult, clipRange, userPrompt, onClose, onTryAgain, onPost }) {
  const previewVideoRef  = useRef(null)
  const generatedVidRef  = useRef(null)
  const audioRef         = useRef(null)
  const [showGenerated, setShowGenerated]             = useState(false)
  const [animateGenerated, setAnimateGenerated]       = useState(false)
  const [generatedVideoReady, setGeneratedVideoReady] = useState(false)
  const [showPostScreen, setShowPostScreen]           = useState(false)

  const imageDataUrl = generatedResult?.imageDataUrl ?? null
  const rawVideoUri  = generatedResult?.videoUri ?? null
  // Pass the raw URI to the proxy — the server applies the API key server-side
  // via both query param and x-goog-api-key header (the reliable path)
  const proxiedVideoUri = rawVideoUri
    ? `${BACKEND_URL}/api/video-proxy?uri=${encodeURIComponent(rawVideoUri)}`
    : null

  useEffect(() => {
    setShowGenerated(false)
    setAnimateGenerated(false)
    setGeneratedVideoReady(false)
  }, [rawVideoUri, imageDataUrl, clipRange?.startTime, clipRange?.endTime])

  useEffect(() => {
    if (!showGenerated) return
    if (rawVideoUri && !generatedVideoReady) return
    const id = setTimeout(() => {
      setAnimateGenerated(true)
      generatedVidRef.current?.play().catch(() => {})
    }, CROSSFADE_DELAY_MS)
    return () => clearTimeout(id)
  }, [showGenerated, rawVideoUri, generatedVideoReady])

  useEffect(() => {
    const el  = previewVideoRef.current
    const bgm = audioRef.current
    if (!el) return
    const startTime = clipRange?.startTime ?? 0
    const endTime   = clipRange?.endTime   ?? null
    el.currentTime  = startTime
    el.play().catch(() => {})
    bgm?.play().catch(() => {})

    function triggerCrossfade() {
      setShowGenerated(true)
      generatedVidRef.current?.load()
    }

    if (endTime !== null) {
      function onTimeUpdate() {
        if (el.currentTime >= endTime) { el.pause(); triggerCrossfade() }
      }
      el.addEventListener('timeupdate', onTimeUpdate)
      return () => el.removeEventListener('timeupdate', onTimeUpdate)
    }
    el.addEventListener('ended', triggerCrossfade)
    return () => el.removeEventListener('ended', triggerCrossfade)
  }, [clipRange]) // eslint-disable-line react-hooks/exhaustive-deps

  if (showPostScreen) {
    return (
      <PostScreen
        imageDataUrl={imageDataUrl}
        userPrompt={userPrompt}
        onPost={(caption) => {
          onPost?.(imageDataUrl, caption, {
            sourceVideoUrl:    video.src,
            generatedVideoUrl: rawVideoUri,
            videoSrc:          video.src,
            clipStart:         clipRange?.startTime ?? 0,
            clipEnd:           clipRange?.endTime   ?? null,
          })
          onClose()
        }}
        onBack={() => setShowPostScreen(false)}
      />
    )
  }

  return (
    <div className="preview-screen">
      <audio ref={audioRef} src="/audio/bgm.mp3" loop preload="auto" />

      {/* Rounded video container */}
      <div className="pv-container">
        {/* Video layer */}
        <video
          ref={previewVideoRef}
          className="pv-video"
          src={video.src}
          playsInline
          muted
        />

        {/* Generated overlay */}
        {rawVideoUri ? (
          <video
            ref={generatedVidRef}
            src={proxiedVideoUri}
            className={['pv-generated', showGenerated && generatedVideoReady ? 'pv-generated--visible' : ''].join(' ')}
            onLoadedData={() => setGeneratedVideoReady(true)}
            playsInline muted loop preload="auto"
          />
        ) : imageDataUrl ? (
          <img
            src={imageDataUrl}
            className={[
              'pv-generated',
              showGenerated    ? 'pv-generated--visible' : '',
              animateGenerated ? 'pv-generated--animate'  : '',
            ].join(' ')}
            alt="generated moment"
          />
        ) : null}

        {/* X close */}
        <button className="pv-close" onClick={onClose}>✕</button>

        {/* Music chip — top center */}
        <div className="pv-music-chip">
          <img src="/icons/music.svg" width={13} height={13} alt="" />
          <span className="pv-music-chip__text">Jungle Jungle</span>
        </div>

        {/* Right icon strip */}
        <div className="pv-right-strip">
          <PvIconBtn><SettingsIcon /></PvIconBtn>
          <PvIconBtn><PvShareIcon /></PvIconBtn>
          <div className="pv-strip-divider" />
          <PvIconBtn><img src="/icons/pv-fonts.svg" width={24} height={24} alt="" /></PvIconBtn>
          <PvIconBtn><StickerIcon /></PvIconBtn>
          <PvIconBtn><AutoIcon /></PvIconBtn>
          <PvIconBtn><FilterIcon /></PvIconBtn>
          <PvIconBtn><MicIcon /></PvIconBtn>
          <PvIconBtn><CaptionsIcon /></PvIconBtn>
          <PvIconBtn><SoundIcon /></PvIconBtn>
        </div>

        {/* Bottom gradient */}
        <div className="pv-gradient" />
      </div>

      {/* Bottom action buttons */}
      <div className="pv-bottom-actions">
        <button className="pv-your-story" onClick={onTryAgain}>
          <img src="/images/story.png" alt="" style={{ height: '2em', width: 'auto', marginRight: 6, flexShrink: 0 }} />
          Your Story
        </button>
        <button className="pv-next-btn" onClick={() => setShowPostScreen(true)}>
          Next
        </button>
      </div>
    </div>
  )
}

/* ── Post Screen ──────────────────────────────────────── */

function PostScreen({ imageDataUrl, userPrompt, onPost, onBack }) {
  const [caption, setCaption] = useState(
    userPrompt ? `#Stitched myself in · ${userPrompt}` : '#Stitched myself in'
  )

  return (
    <div className="post-screen">
      {/* Header */}
      <div className="post-header">
        <button className="post-back-btn" onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Caption (left) + Preview thumb (right) */}
      <div className="post-top-row">
        <textarea
          className="post-caption-input"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={200}
          placeholder="#stitch with ▶ @you"
        />
        <div className="post-preview-thumb">
          <span className="post-preview-label">Preview</span>
          {imageDataUrl && <img src={imageDataUrl} className="post-preview-img" alt="preview" />}
          <span className="post-preview-cover">Edit cover</span>
        </div>
      </div>

      {/* Hashtag / Mention chips */}
      <div className="post-tag-row">
        <button className="post-tag-chip"># Hashtags</button>
        <button className="post-tag-chip">@ Mention</button>
      </div>

      <div className="post-divider" />

      {/* Settings rows */}
      <PostSettingRow icon={<PostLocationIcon />} label="Location">
        <div className="post-location-chips">
          <span className="post-location-chip">Goat Island</span>
          <span className="post-location-chip">San Francisco Bay</span>
          <span className="post-location-chip">Sun's Out Buns Out</span>
        </div>
      </PostSettingRow>
      <div className="post-divider" />
      <PostSettingRow icon={<PostLinkIcon />}     label="Add link" />
      <div className="post-divider" />
      <PostSettingRow icon={<PostGlobeIcon />}    label="Everyone can view this post" />
      <div className="post-divider" />
      <PostSettingRow icon={<PostMoreIcon />}     label="More options" />
      <div className="post-divider" />
      <PostSettingRow icon={<PostShareToIcon />}  label="Share to" />
      <div className="post-divider" />

      {/* Bottom actions */}
      <div className="post-actions">
        <button className="post-drafts-btn" onClick={onBack}>
          <PostDraftsIcon />
          Drafts
        </button>
        <button className="post-publish-btn" onClick={() => onPost(caption)}>
          <PostUploadIcon />
          Post
        </button>
      </div>
    </div>
  )
}

function PostSettingRow({ icon, label, children }) {
  return (
    <div className="post-setting-row">
      <div className="post-setting-row__main">
        <span className="post-setting-row__icon">{icon}</span>
        <span className="post-setting-row__label">{label}</span>
        <svg className="post-setting-row__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
      {children && <div className="post-setting-row__sub">{children}</div>}
    </div>
  )
}

function PostLocationIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function PostLinkIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
}
function PostGlobeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
}
function PostMoreIcon() {
  return <img src="/icons/pv-settings-bk.svg" width={18} height={18} alt="" />
}
function PostShareToIcon() {
  return <img src="/icons/pv-share-bk.svg" width={18} height={18} alt="" />
}
function PostDraftsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
}
function PostUploadIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/><path d="M20 17v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"/></svg>
}

/* ── Icon wrappers ──────────────────────────────────────── */

function PvIconBtn({ children }) {
  return <button className="pv-icon-btn">{children}</button>
}

function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}
function PvShareIcon()   { return <img src="/icons/pv-share.svg"    width={24} height={24} alt="" /> }
function StickerIcon()   { return <img src="/icons/pv-sticker.svg"  width={24} height={24} alt="" /> }
function AutoIcon()      { return <img src="/icons/pv-auto.svg"     width={24} height={24} alt="" /> }
function FilterIcon()    { return <img src="/icons/pv-filter.svg"   width={24} height={24} alt="" /> }
function MicIcon()       { return <img src="/icons/pv-mic.svg"      width={24} height={24} alt="" /> }
function CaptionsIcon()  { return <img src="/icons/pv-captions.svg" width={24} height={24} alt="" /> }
function SoundIcon()     { return <img src="/icons/pv-sound.svg"    width={24} height={24} alt="" /> }
