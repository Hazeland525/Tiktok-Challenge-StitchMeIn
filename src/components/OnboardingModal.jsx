export default function OnboardingModal({ video, onStart, onClose }) {
  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Close */}
        <button className="onboarding-close" onClick={onClose}>✕</button>

        {/* Illustration */}
        <div className="onboarding-illustration">
          <img
            src="/images/onboarding.png"
            alt="Stitch yourself in"
            className="onboarding-illustration__img"
          />
        </div>

        {/* Title */}
        <h2 className="onboarding-title">Stitch Me In</h2>

        {/* Subtitle */}
        <p className="onboarding-subtitle">
          Join people's video and make it your own new chapter!
        </p>

        {/* Full-width divider */}
        <div className="onboarding-divider" />

        {/* CTA */}
        <button className="onboarding-try-btn" onClick={onStart}>
          Try it
        </button>
      </div>
    </div>
  )
}
