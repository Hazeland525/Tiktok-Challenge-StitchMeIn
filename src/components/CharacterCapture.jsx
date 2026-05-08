import { useState, useRef, useEffect } from 'react'

export default function CharacterCapture({ onConfirm, onBack }) {
  const [mode, setMode]               = useState('camera')  // 'camera' | 'preview'
  const [photo, setPhoto]             = useState(null)
  const [cameraError, setCameraError] = useState(false)
  const liveVideoRef = useRef(null)
  const streamRef    = useRef(null)
  const fileInputRef = useRef(null)

  // Start / stop camera stream
  useEffect(() => {
    if (mode !== 'camera') {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      return
    }
    setCameraError(false)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream
          const p = liveVideoRef.current.play()
          if (p !== undefined) {
            p.catch(err => { if (err.name !== 'AbortError') console.error('Camera play error:', err) })
          }
        }
      })
      .catch(() => {
        setCameraError(true)
        setMode(null)
      })
    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [mode])

  function captureSnapshot() {
    const vid = liveVideoRef.current
    if (!vid) return
    const canvas = document.createElement('canvas')
    canvas.width  = vid.videoWidth  || 480
    canvas.height = vid.videoHeight || 640
    canvas.getContext('2d').drawImage(vid, 0, 0)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setPhoto(canvas.toDataURL('image/jpeg', 0.9))
    setMode('preview')
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setPhoto(ev.target.result); setMode('preview') }
    reader.readAsDataURL(file)
  }

  function handleRetake() {
    setPhoto(null)
    setMode('camera')
  }

  const isPreview = mode === 'preview' && !!photo

  return (
    <div className="character-capture">
      {/* Top bar */}
      <div className="cc-topbar">
        <button className="cc-back-btn" onClick={isPreview ? handleRetake : onBack}>
          <img src="/icons/goback.svg" width={24} height={24} alt="back" />
        </button>
      </div>

      {/* Circular viewfinder with ring */}
      <div className="cc-viewfinder-wrap">
        <div className="cc-circle-area">
          <div className={`cc-ring${isPreview ? ' cc-ring--captured' : ''}`} />
          <div className="cc-viewfinder">
            {mode === 'camera' && (
              <video
                ref={liveVideoRef}
                className="cc-camera-feed"
                autoPlay
                playsInline
                muted
              />
            )}
            {isPreview && (
              <img src={photo} className="cc-photo-img" alt="your photo" />
            )}
            {mode !== 'camera' && !photo && (
              <div className="cc-viewfinder-placeholder">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {cameraError && (
          <p className="cc-viewfinder-hint" style={{ color: '#FE2C55' }}>
            Camera denied — tap Upload below
          </p>
        )}
      </div>

      {/* Label between circle and shutter */}
      <p className="cc-tap-hint" style={isPreview ? { color: '#FE2C55' } : {}}>
        {isPreview ? 'Looking great!' : 'Tap to take photo'}
      </p>

      {/* Bottom action bar */}
      <div className="cc-bottom-bar">
        {!isPreview ? (
          <>
            {/* Upload */}
            <button
              className="cc-side-action"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="cc-side-thumb">
                <img src="/images/upload.png" alt="" className="cc-side-thumb__img" />
              </div>
              <span className="cc-side-label">Upload</span>
            </button>

            {/* Shutter — capture */}
            <button className="cc-shutter" onClick={captureSnapshot}>
              <div className="cc-shutter-inner" />
            </button>

            {/* AI Self */}
            <button className="cc-side-action" onClick={() => {}}>
              <div className="cc-side-thumb cc-side-thumb--round">
                <img src="/images/myaiself.png" alt="" className="cc-side-thumb__img" />
              </div>
              <span className="cc-side-label">My AI Self</span>
            </button>
          </>
        ) : (
          <>
            {/* Retake */}
            <button className="cc-side-action" onClick={handleRetake}>
              <div className="cc-side-thumb">
                <img src="/images/retake.png" alt="" className="cc-side-thumb__img" />
              </div>
              <span className="cc-side-label">Retake</span>
            </button>

            {/* Shutter — confirm (red + checkmark) */}
            <button className="cc-shutter cc-shutter--captured" onClick={() => onConfirm(photo)}>
              <span className="cc-shutter-check">✓</span>
            </button>

            {/* Spacer */}
            <div style={{ width: 72 }} />
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}
