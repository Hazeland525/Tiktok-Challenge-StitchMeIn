import { useRef, useState, useEffect } from 'react'
import VideoCard from './VideoCard'
import './components.css'

const VIDEOS = [
  {
    id: 1,
    src: '/videos/video1.mp4',
    user: '@goldenpup',
    caption: 'sunday zoomies 🐾',
    likes: '284K',
    comments: '3.2K',
    avatar: '/images/profile1.png',
  },
  {
    id: 2,
    src: '/videos/video2.mp4',
    user: '@tablefortwo',
    caption: 'when the tasting menu hits different ✨',
    likes: '91K',
    comments: '1.8K',
    avatar: '/images/profile2.png',
  },
  {
    id: 3,
    src: '/videos/video3.mp4',
    user: '@wanderlust.reel',
    caption: 'santorini at magic hour 🌅',
    likes: '512K',
    comments: '7.4K',
    avatar: '/images/profile3.png',
  },
  {
    id: 4,
    src: '/videos/video4.mp4',
    user: '@citylights.mov',
    caption: 'golden hour never gets old 🌇',
    likes: '173K',
    comments: '2.1K',
    avatar: '/images/profile5.png',
  },
]

const SNAP_THRESHOLD = 0.15
const CLICK_MAX_MOVE = 6

export default function Feed({ onStitchIn, stitchOpen, generatedPosts = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const [paused, setPaused] = useState(false)
  const wrapperRef = useRef(null)
  const drag = useRef({ active: false, startY: 0 })
  // Keep total count in a ref so drag closures always see the latest value
  const totalCountRef = useRef(VIDEOS.length)
  totalCountRef.current = generatedPosts.length + VIDEOS.length

  // Jump to the newly generated post (always prepended at index 0) on each new post
  useEffect(() => {
    if (generatedPosts.length > 0) {
      setCurrentIndex(0)
      setPaused(false)
    }
  }, [generatedPosts.length])

  const slideH = () => wrapperRef.current?.clientHeight ?? window.innerHeight

  function startDrag(clientY) {
    drag.current = { active: true, startY: clientY }
    setSnapping(false)
  }

  function moveDrag(clientY) {
    if (!drag.current.active) return
    const raw = clientY - drag.current.startY
    const atTop    = currentIndex === 0 && raw > 0
    const atBottom = currentIndex === totalCountRef.current - 1 && raw < 0
    setDragOffset(atTop || atBottom ? raw * 0.25 : raw)
  }

  function endDrag(clientY) {
    if (!drag.current.active) return
    drag.current.active = false

    const moved = Math.abs(clientY - drag.current.startY)

    if (moved < CLICK_MAX_MOVE) {
      setPaused((p) => {
        console.log('%c👤 ' + (!p ? 'Paused video' : 'Resumed video'), 'color:#FFBC28;font-weight:600')
        return !p
      })
      setDragOffset(0)
      return
    }

    const threshold = slideH() * SNAP_THRESHOLD
    setSnapping(true)

    if (dragOffset < -threshold && currentIndex < totalCountRef.current - 1) {
      console.log('%c👤 Scrolled to video ' + (currentIndex + 2), 'color:#FFBC28;font-weight:600')
      setCurrentIndex(currentIndex + 1)
      setPaused(false)
    } else if (dragOffset > threshold && currentIndex > 0) {
      console.log('%c👤 Scrolled to video ' + currentIndex, 'color:#FFBC28;font-weight:600')
      setCurrentIndex(currentIndex - 1)
      setPaused(false)
    }

    setDragOffset(0)
  }

  useEffect(() => {
    function onMouseMove(e) { moveDrag(e.clientY) }
    function onMouseUp(e) { endDrag(e.clientY) }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  })

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const block = (e) => e.preventDefault()
    el.addEventListener('wheel', block, { passive: false })
    return () => el.removeEventListener('wheel', block)
  }, [])

  const translateY = -currentIndex * slideH()

  return (
    <div
      ref={wrapperRef}
      className="feed-wrapper"
      onMouseDown={(e) => startDrag(e.clientY)}
    >
      {/* Slide stack — transform and transition are dynamic */}
      <div
        className="slide-stack"
        style={{
          transform: `translateY(calc(${translateY}px + ${dragOffset}px))`,
          transition: snapping && !drag.current.active
            ? 'transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : 'none',
        }}
        onTransitionEnd={() => setSnapping(false)}
      >
        {[...generatedPosts, ...VIDEOS].map((video, index) => (
          <VideoCard
            key={video.id}
            video={video}
            index={index}
            isActive={currentIndex === index}
            paused={currentIndex === index && paused}
            stitchOpen={stitchOpen}
            onStitchIn={(videoEl) => onStitchIn?.(videoEl, video, index)}
          />
        ))}
      </div>

      <TopBar />
      <BottomNav />
    </div>
  )
}

function TopBar() {
  const [active, setActive] = useState('foryou')

  return (
    <div className="top-bar">
      <img src="/icons/live.svg" className="top-bar__live-icon" alt="LIVE" />

      <div className="top-bar__center">
        {['following', 'foryou'].map((tab) => (
          <button
            key={tab}
            className="top-bar__tab"
            onClick={() => setActive(tab)}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              color: active === tab ? '#fff' : 'rgba(255,255,255,0.55)',
              fontWeight: active === tab ? 700 : 400,
            }}
          >
            {tab === 'foryou' ? 'For You' : 'Following'}
            {active === tab && <span className="top-bar__underline" />}
          </button>
        ))}
      </div>

      <button
        className="top-bar__search"
        style={{ marginLeft: 'auto' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="22" y2="22" />
        </svg>
      </button>
    </div>
  )
}

function BottomNav() {
  const [active, setActive] = useState('home')

  const tabs = [
    { id: 'home',     label: 'Home',     icon: HomeIcon },
    { id: 'discover', label: 'Discover', icon: DiscoverIcon },
    { id: 'create',   label: '',         icon: CreateIcon, isCreate: true },
    { id: 'inbox',    label: 'Inbox',    icon: InboxIcon },
    { id: 'profile',  label: 'Profile',  icon: ProfileIcon },
  ]

  return (
    <div className="bottom-nav" onMouseDown={(e) => e.stopPropagation()}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className="bottom-nav__tab"
          onClick={() => setActive(tab.id)}
          /* color is dynamic */
          style={{ color: tab.isCreate ? '#fff' : (active === tab.id ? '#fff' : '#888') }}
        >
          <tab.icon active={active === tab.id} />
          {!tab.isCreate && (
            <span
              className="bottom-nav__label"
              /* fontWeight and color are dynamic */
              style={{
                fontWeight: active === tab.id ? 600 : 400,
                color: active === tab.id ? '#fff' : '#888',
              }}
            >
              {tab.label}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function HomeIcon({ active }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={active ? 'white' : 'none'} stroke="white" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" fill="none" stroke="white" strokeWidth="1.8" />
    </svg>
  )
}

function DiscoverIcon({ active }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7.5" />
      <line x1="17" y1="17" x2="22" y2="22" />
    </svg>
  )
}

function CreateIcon() {
  return (
    <div className="create-icon">
      <div className="create-icon__left" />
      <div className="create-icon__center">
        <span className="create-icon__plus">+</span>
      </div>
      <div className="create-icon__right" />
    </div>
  )
}

function InboxIcon({ active }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function ProfileIcon({ active }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={active ? 'white' : 'none'} stroke="white" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeWidth="1.8" fill="none" stroke="white" />
    </svg>
  )
}
