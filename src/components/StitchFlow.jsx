import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import OnboardingModal  from './OnboardingModal'
import ClipSelector     from './ClipSelector'
import CharacterCapture from './CharacterCapture'
import GenerationLoader from './GenerationLoader'
import PreviewScreen    from './PreviewScreen'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

// Icons used in both scatter (remix) and orbit (loading) layouts
const REMIX_ICONS = [
  { src: '/icons/flower1.svg', size: 30, rx:  -87, ry: -192 },
  { src: '/icons/heart.svg',   size: 40, rx:   27, ry: -171 },
  { src: '/icons/dots.svg',    size: 24, rx:  114, ry: -171 },
  { src: '/icons/diamond.svg', size: 36, rx: -156, ry: -121 },
  { src: '/icons/flower2.svg', size: 30, rx:  167, ry: -131 },
  { src: '/icons/star.svg',    size: 30, rx:   34, ry:   -20 },
  { src: '/icons/curve1.svg',  size: 70, rx: -121, ry:   -10 },
  { src: '/icons/arrow.svg',   size: 50, rx:  136, ry:   -40 },
]

const ORBIT_R = 110
const ORBIT_POS = REMIX_ICONS.map((_, i) => {
  const angle = (i / REMIX_ICONS.length) * 2 * Math.PI - Math.PI / 2
  return {
    x: Math.round(Math.cos(angle) * ORBIT_R),
    y: Math.round(Math.sin(angle) * ORBIT_R),
  }
})

const MOVE_EASE = [0.25, 0.46, 0.45, 0.94]

/* ── PersistentIcons ─────────────────────────────────────────
   Stays mounted across BOTH step 4 and step 5 — icons never
   unmount, so Framer Motion can tween from scatter → orbit.

   step 4 (remix):   icons float at their scatter (rx/ry) positions
   step 5 loading:   icons fly 1.5s to orbit ring
   phase orbiting:   outer wrapper spins (7s), inner breathes, icons counter-rotate
*/
function PersistentIcons({ step, phase }) {
  const EASE       = MOVE_EASE
  const isOrbiting = phase === 'orbiting'
  const inOrbit    = step === 5           // animate toward/in orbit

  return (
    <div className="ah-overlay">
      <div className="ah-anchor">
        {/* Outer: rotates the whole ring when orbiting */}
        <motion.div
          style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}
          animate={{ rotate: isOrbiting ? 360 : 0 }}
          transition={{
            rotate: isOrbiting
              ? { duration: 7, repeat: Infinity, ease: 'linear', repeatType: 'loop' }
              : { duration: 0 },
          }}
        >
          {/* Inner: breathes (scale) when orbiting */}
          <motion.div
            style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}
            animate={{ scale: isOrbiting ? [1, 1.15, 1] : 1 }}
            transition={{
              scale: isOrbiting
                ? { duration: 3, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }
                : { duration: 0 },
            }}
          >
            {REMIX_ICONS.map((icon, i) => {
              const half      = icon.size / 2
              const scatterX  = icon.rx - half
              const scatterY  = icon.ry - half
              // diamond(3)→slot7, flower2(4)→slot3, arrow(7)→slot4
              const orbitSlot = i === 3 ? 7 : i === 4 ? 3 : i === 7 ? 4 : i
              const orbitX    = ORBIT_POS[orbitSlot].x - half
              const orbitY    = ORBIT_POS[orbitSlot].y - half

              return (
                <motion.img
                  key={icon.src}
                  src={icon.src}
                  className="ah-icon"
                  style={{ width: icon.size, height: icon.size }}
                  animate={
                    inOrbit
                      ? {
                          x:      orbitX,
                          y:      orbitY,
                          rotate: isOrbiting ? -360 : 0,
                        }
                      : {
                          x:      scatterX,
                          y:      [scatterY, scatterY - 7, scatterY],
                          rotate: 0,
                        }
                  }
                  transition={
                    inOrbit
                      ? {
                          x:      { duration: 1.5, ease: EASE },
                          y:      { duration: 1.5, ease: EASE },
                          rotate: isOrbiting
                            ? { duration: 7, repeat: Infinity, ease: 'linear', repeatType: 'loop' }
                            : { duration: 0 },
                        }
                      : {
                          x:      { duration: 0 },
                          y:      {
                            duration:   2 + i * 0.18,
                            repeat:     Infinity,
                            ease:       'easeInOut',
                            repeatType: 'mirror',
                            delay:      i * 0.14,
                          },
                          rotate: { duration: 0 },
                        }
                  }
                />
              )
            })}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

/* ── AnimatedHero ────────────────────────────────────────────
   Mounts when heroPhase !== 'remix'.
   Single persistent nested structure — no DOM swap between phases.

   Phase 'loading':
     • Icons fly scatter → orbit (1.5s). Outer wrapper rotate=0, scale=1.
   Phase 'orbiting':
     • Outer wrapper starts rotate:360 loop (7s). Inner wrapper breathes scale.
     • Icons counter-rotate so they stay upright.
     • Scene gets a subtle scale bump. Avatar is already gone.
*/
function AnimatedHero({ startFrame, userPhoto, phase, scenePreview }) {
  const EASE      = MOVE_EASE
  const isOrbiting = phase === 'orbiting'

  return (
    <div className="ah-overlay">
      <div className="ah-anchor">

        {/* ── Scene card ─────────────────────────────────── */}
        <motion.div
          className="ah-scene-wrap"
          initial={{ x: -60, y: -100, scale: 1 }}
          animate={{
            x:     0,
            y:     0,
            scale: isOrbiting ? 1.06 : 1,
          }}
          transition={{
            x:     { duration: 1.5, ease: EASE },
            y:     { duration: 1.5, ease: EASE },
            scale: { duration: 0.6, ease: EASE },
          }}
        >
          <div className="loading-preview-card" style={{ width: 124, height: 164 }}>
            {(scenePreview || startFrame)
              ? <img src={scenePreview ?? startFrame} className="loading-preview-img" alt="scene" />
              : <div className="loading-preview-placeholder">✦</div>
            }
          </div>
        </motion.div>

        {/* ── User avatar: fades + shrinks as scene takes over ─ */}
        <motion.div
          className="ah-avatar-wrap"
          initial={{ x: 74, y: -100, opacity: 1, scale: 1 }}
          animate={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
          transition={{ duration: 1.2, ease: EASE }}
        >
          {userPhoto
            ? <img src={userPhoto} className="ah-avatar-img" alt="you" />
            : <div className="ah-avatar-placeholder">🙋</div>
          }
        </motion.div>


      </div>
    </div>
  )
}

/* ── StitchFlow ──────────────────────────────────────────────
   Steps:
     1 = Onboarding modal
     2 = Clip selection
     3 = Character capture
     4 = Remix prompt
     5 = Generation loading
     6 = Preview + Post
*/
export default function StitchFlow({ videoEl, video, pausedTime = 0, onClose, onPost }) {
  const [step, setStep]                               = useState(1)
  const [referenceSceneFrame, setReferenceSceneFrame] = useState(null)
  const [clipRange, setClipRange]                     = useState(null)
  const [userPhoto, setUserPhoto]                     = useState(null)
  const [userPrompt, setUserPrompt]                   = useState('')
  const [generatedResult, setGeneratedResult]         = useState(null)

  // Hero animation phase: 'remix' | 'loading' | 'orbiting'
  const [heroPhase, setHeroPhase]                   = useState('remix')
  const [loaderScenePreview, setLoaderScenePreview] = useState(null)

  // Chip prompts — fetched at StitchFlow level so pre-fetch can start during step 3
  const [chips, setChips]               = useState([])
  const [chipsLoading, setChipsLoading] = useState(false)

  const fetchChips = useCallback(async (sceneFrame) => {
    setChipsLoading(true)
    console.log('%c🤖 Calling /api/generate-prompts — generating idea chips from scene', 'color:#00EEE0;font-weight:600')
    try {
      const base64 = sceneFrame ? sceneFrame.replace(/^data:[^;]+;base64,/, '') : null
      const res = await fetch(`${BACKEND_URL}/api/generate-prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneImageBase64: base64 }),
      })
      const data = await res.json()
      if (Array.isArray(data.prompts) && data.prompts.length) {
        setChips(data.prompts)
        console.log('Idea chips ready: ' + data.prompts.slice(0, 2).join(' · ') + '…')
      }
    } catch (e) {
      console.error('generate-prompts failed:', e)
    } finally {
      setChipsLoading(false)
    }
  }, [])

  // Called when user confirms capture — pre-fetch prompts while they're still on step 3
  function handleCaptureConfirm(photo) {
    console.log('%c👤 Photo captured — opening remix prompt', 'color:#FFBC28;font-weight:600')
    setUserPhoto(photo)
    setChips([])
    fetchChips(referenceSceneFrame)
    setStep(4)
  }

  // Kick off generation: start hero transition, mount loader simultaneously
  function handleGenerate() {
    console.log('%c👤 Tapped "Stitch Me In" — prompt: "' + userPrompt + '"', 'color:#FFBC28;font-weight:600')
    setHeroPhase('loading')
    setStep(5)
    setTimeout(() => setHeroPhase('orbiting'), 1500)
  }

  // Return to remix prompt from loader
  function handleModify() {
    console.log('%c👤 Tapped "Modify Description" — returning to prompt', 'color:#FFBC28;font-weight:600')
    setHeroPhase('remix')
    setLoaderScenePreview(null)
    setStep(4)
  }

  return (
    <>
      {/* Dark overlay behind sheets (steps 1-3). Click-outside only on step 1. */}
      {step >= 1 && step <= 3 && (
        <div
          className="stitch-overlay"
          onClick={step === 1 ? onClose : undefined}
        />
      )}

      {/* Solid black bg behind steps 4-5 so feed video doesn't bleed through */}
      {step >= 4 && step <= 5 && (
        <div className="stitch-screen-bg" />
      )}

      {/* Step 1 — Onboarding */}
      {step === 1 && (
        <OnboardingModal
          video={video}
          onStart={() => setStep(2)}
          onClose={onClose}
        />
      )}

      {/* Step 2 — Clip selection */}
      {step === 2 && (
        <ClipSelector
          videoEl={videoEl}
          pausedTime={pausedTime}
          onConfirm={(frame, range) => {
            console.log('%c👤 Clip selected — ' + range.startTime.toFixed(1) + 's → ' + range.endTime.toFixed(1) + 's', 'color:#FFBC28;font-weight:600')
            setReferenceSceneFrame(frame); setClipRange(range); setStep(3)
          }}
          onClose={onClose}
        />
      )}

      {/* Step 3 — Character capture */}
      {step === 3 && (
        <CharacterCapture
          onConfirm={handleCaptureConfirm}
          onBack={() => setStep(2)}
        />
      )}

      {/* Step 4 — Remix prompt (AnimatePresence gives it an exit fade) */}
      <AnimatePresence>
        {step === 4 && (
          <RemixPromptSheet
            key="remix"
            startFrame={referenceSceneFrame}
            userPhoto={userPhoto}
            userPrompt={userPrompt}
            setUserPrompt={setUserPrompt}
            chips={chips}
            chipsLoading={chipsLoading}
            onRefreshChips={() => { setChips([]); fetchChips(referenceSceneFrame) }}
            onGenerate={handleGenerate}
            onBack={() => setStep(3)}
          />
        )}
      </AnimatePresence>

      {/* Step 5 — Generation loading (hero area hidden; AnimatedHero covers it) */}
      {step === 5 && (
        <GenerationLoader
          startFrame={referenceSceneFrame}
          userPhoto={userPhoto}
          userPrompt={userPrompt}
          hideHero
          onScenePreview={setLoaderScenePreview}
          onComplete={(result) => { setGeneratedResult(result); setStep(6) }}
          onModify={handleModify}
        />
      )}

      {/* PersistentIcons — stays mounted across steps 4 AND 5 so icons
          never unmount and Framer Motion can tween scatter → orbit. */}
      {(step === 4 || step === 5) && (
        <PersistentIcons step={step} phase={heroPhase} />
      )}

      {/* AnimatedHero — scene card + avatar only (icons live in PersistentIcons) */}
      {heroPhase !== 'remix' && (step === 4 || step === 5) && (
        <AnimatedHero
          startFrame={referenceSceneFrame}
          userPhoto={userPhoto}
          phase={heroPhase}
          scenePreview={loaderScenePreview}
        />
      )}

      {/* Step 6 — Preview + Post */}
      {step === 6 && (
        <PreviewScreen
          video={video}
          generatedResult={generatedResult}
          clipRange={clipRange}
          userPrompt={userPrompt}
          onClose={onClose}
          onTryAgain={() => setStep(4)}
          onPost={(imageUrl, caption, clipContext) => {
            console.log('%c👤 Posted! Caption: "' + caption + '"', 'color:#FFBC28;font-weight:600')
            onPost?.(imageUrl, caption, {
              ...clipContext,
              generatedVideoUrl: generatedResult?.videoUri   ?? null,
              engineUsed:        generatedResult?.engineUsed ?? null,
            })
          }}
        />
      )}
    </>
  )
}

/* ── Remix Prompt Screen (step 4) ────────────────────────── */

function RemixPromptSheet({
  startFrame, userPhoto,
  userPrompt, setUserPrompt,
  chips, chipsLoading, onRefreshChips,
  onGenerate, onBack,
}) {
  return (
    <motion.div
      className="remix-screen"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* X close */}
      <button className="remix-close" onClick={onBack}>✕</button>

      {/* Hero: scene + user circle + scattered floating decorations */}
      <div className="remix-hero">
        <div className="remix-scene">
          {startFrame
            ? <img src={startFrame} className="remix-scene__img" alt="scene" />
            : <div className="remix-scene__empty">🎬</div>
          }
        </div>

        <div className="remix-avatar">
          {userPhoto
            ? <img src={userPhoto} className="remix-avatar__img" alt="you" />
            : <div className="remix-avatar__empty">🙋</div>
          }
        </div>

        {/* Icons handled by PersistentIcons layer — no rx-deco here */}
      </div>

      {/* Describe your idea */}
      <div className="remix-prompt-section">
        <h2 className="remix-prompt-title">Describe your idea</h2>

        <div className="remix-prompt-box">
          <textarea
            className="remix-prompt-textarea"
            placeholder="Describe how you want to join the video."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
          />
          <div className="remix-chips-area">
            <div className="remix-chips-wrap">
              {chipsLoading
                ? <span className="remix-chips-loading">Generating ideas…</span>
                : chips.map((chip) => (
                    <button
                      key={chip}
                      className="remix-chip"
                      onClick={() => setUserPrompt(chip)}
                    >
                      {chip}
                    </button>
                  ))
              }
            </div>
            <button className="remix-chips-refresh" onClick={onRefreshChips} disabled={chipsLoading}>↻</button>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="remix-cta-wrap">
        <button
          className="remix-cta"
          onClick={onGenerate}
          disabled={!userPrompt.trim()}
        >
          <img src="/icons/stitch.svg" alt="" style={{ width: 18, height: 18, marginRight: 8, flexShrink: 0 }} />
          Stitch Me In
        </button>
      </div>
    </motion.div>
  )
}
