import { useState, useEffect } from 'react'
import { generateEndFrame } from '../api/generateEndFrame'
import { generateVideo    } from '../api/generateVideo'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

const ENGINE_LABEL = {
  KLING: 'Kling v3 Omni is animating…',
  VEO:   'Google Veo is processing…',
}

const ORBIT_ICONS = [
  { src: '/icons/flower1.svg', size: 24 },
  { src: '/icons/heart.svg',   size: 22 },
  { src: '/icons/dots.svg',    size: 16 },
  { src: '/icons/diamond.svg', size: 22 },
  { src: '/icons/flower2.svg', size: 20 },
  { src: '/icons/star.svg',    size: 22 },
  { src: '/icons/curve1.svg',  size: 20 },
  { src: '/icons/arrow.svg',   size: 18 },
]

export default function GenerationLoader({
  startFrame, userPhoto, userPrompt,
  onComplete, onModify,
  hideHero = false,
  onScenePreview = null,
}) {
  const [stage, setStage]               = useState(0)    // 0 | 1 | 2
  const [engine, setEngine]             = useState(null) // fetched from server
  const [, setDevMode]                  = useState(false)
  const [scenePreview, setScenePreview] = useState(null)
  const [error, setError]               = useState(null)
  const [dots, setDots]                 = useState('.')

  // Dot animation
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? '.' : d + '.')), 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        // ── Fetch engine config first so UI and onComplete are both accurate ──
        // ── Fetch engine config (determines labels, devMode timing) ────────
        let activeEngine    = 'KLING' // safe fallback
        let isDevMode        = false
        let stageDurationsMs = [0, 0, 0]
        try {
          const cfg  = await fetch(`${BACKEND_URL}/api/engine-config`)
          const json = await cfg.json()
          activeEngine     = json.engine            ?? activeEngine
          isDevMode        = json.devMode           ?? false
          stageDurationsMs = json.stageDurationsMs  ?? [0, 0, 0]
        } catch {
          console.warn('Could not fetch engine config, defaulting to KLING')
        }
        if (!cancelled) { setEngine(activeEngine); setDevMode(isDevMode) }
        console.log('Engine: ' + activeEngine + (isDevMode ? ' (dev mode)' : ''))

        const stageDelay = (ms) => new Promise((r) => setTimeout(r, ms))

        // ── Stage 0: Gemini → static image ─────────────────────────────────
        setStage(0)
        console.log('%c🤖 Calling Gemini — compositing user into scene frame', 'color:#00EEE0;font-weight:600')
        const imagePromise = generateEndFrame({
          lastFrameBase64: startFrame,
          userPhotoBase64: userPhoto,
          userPrompt,
        })
        if (isDevMode) await stageDelay(stageDurationsMs[0])
        const { imageDataUrl, usedMockMode: imageMock } = await imagePromise
        if (cancelled) return
        setScenePreview(imageDataUrl)
        onScenePreview?.(imageDataUrl)
        console.log('Scene image ready — handing off to video engine')

        // ── Stage 1: artificial pause (dev mode only) ───────────────────────
        setStage(1)
        if (isDevMode) await stageDelay(stageDurationsMs[1])

        // ── Stage 2: video engine → animated clip ───────────────────────────
        setStage(2)
        console.log('%c🤖 Calling ' + activeEngine + ' — animating the clip', 'color:#00EEE0;font-weight:600')
        let videoUri = null
        let usedMockMode = imageMock
        try {
          const videoPromise = generateVideo({
            generatedImageDataUrl: imageDataUrl,
            lastFrameBase64:       startFrame,
            userPrompt,
          })
          if (isDevMode) await stageDelay(stageDurationsMs[2])
          const result = await videoPromise
          videoUri     = result.videoUri
          usedMockMode = usedMockMode || result.usedMockMode
        } catch (vidErr) {
          console.warn(`${activeEngine} generation failed, using static image:`, vidErr.message)
        }

        if (cancelled) return

        // ── Done ────────────────────────────────────────────────────────────
        console.log('Generation complete' + (videoUri ? ' — video ready' : ' — using static image'))
        onComplete({ imageDataUrl, videoUri, engineUsed: activeEngine, usedMockMode })
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Generation failed')
      }
    }

    run()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Stages built dynamically once engine is known
  const stages = [
    { id: 'scene',  label: 'Capturing scene…'        },
    { id: 'moment', label: 'Generating your moment…' },
    { id: 'video',  label: ENGINE_LABEL[engine] ?? 'Animating your clip…' },
  ]

  const estimateMins = engine === 'KLING' ? '2' : engine === 'VEO' ? '3' : '2–3'

  if (error) {
    return (
      <div className="loading-overlay">
        <div className="loading-error">
          <h3>Generation failed</h3>
          <p>{error}</p>
          <button className="stitch-cta" style={{ maxWidth: 200, margin: '0 auto' }} onClick={onModify}>
            Modify Description
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`loading-overlay${hideHero ? ' loading-overlay--no-hero' : ''}`}>
      {/* Dev mode badge hidden intentionally */}

      {/* Title */}
      <div className="loading-header">
        <h2 className="loading-title">Working on it{dots}</h2>
        <p className="loading-estimate">Estimate: ~{estimateMins} minutes</p>
      </div>

      {/* Center preview with orbiting icons — hidden when AnimatedHero covers this area */}
      {!hideHero ? (
        <div className="loading-center">
          {/* Two-layer orbit: outer breathes, inner spins, icons counter-spin */}
          <div className="gen-orbit-outer">
            <div className="gen-orbit-inner">
              {ORBIT_ICONS.map((icon, i) => (
                <div
                  key={i}
                  className="gen-orbit-slot"
                  style={{ transform: `rotate(${i * 45}deg) translateY(-100px)` }}
                >
                  <img
                    src={icon.src}
                    className="gen-orbit-icon"
                    style={{ width: icon.size, height: icon.size }}
                    alt=""
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="loading-preview-card">
            {(scenePreview || startFrame) ? (
              <img
                src={scenePreview ?? startFrame}
                className="loading-preview-img"
                alt="scene"
              />
            ) : (
              <div className="loading-preview-placeholder">✦</div>
            )}
          </div>
        </div>
      ) : (
        /* Spacer keeps header above / stages below the AnimatedHero orbit */
        <div style={{ height: 320, flexShrink: 0 }} />
      )}

      {/* Stage progress list */}
      <div className="loading-stages-list">
        {stages.map((s, i) => {
          const isDone    = i < stage
          const isActive  = i === stage
          const isPending = i > stage
          return (
            <div
              key={s.id}
              className={[
                'loading-stage-row',
                isActive  ? 'loading-stage-row--active'  : '',
                isDone    ? 'loading-stage-row--done'    : '',
                isPending ? 'loading-stage-row--pending' : '',
              ].join(' ')}
            >
              <div className="loading-stage-row__dot" />
              <span className="loading-stage-row__text">{s.label}</span>
              {isDone && <span className="loading-stage-row__check">✓</span>}
            </div>
          )
        })}
      </div>

      {/* Modify button */}
      <button className="loading-modify-btn" onClick={onModify}>
        Modify Description
      </button>
    </div>
  )
}
