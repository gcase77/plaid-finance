import { Link } from "react-router-dom";
import InteractiveShowcase from "./InteractiveShowcase";

export const supportEmail = "griffinecase7@gmail.com";

function HeroPreview() {
  return (
    <div className="landing-hero-preview card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="landing-hero-preview-bar">
        <span className="chip chip-soft">Live preview</span>
        <span className="chip chip-success">Demo data</span>
      </div>
      <div className="landing-hero-preview-content">
        <div className="landing-hero-stat">
          <span className="muted xs">Income (Apr)</span>
          <strong className="text-success">$7,120</strong>
        </div>
        <div className="landing-hero-stat">
          <span className="muted xs">Spending (Apr)</span>
          <strong className="text-danger">$739</strong>
        </div>
        <div className="landing-hero-stat">
          <span className="muted xs">Net savings</span>
          <strong>$6,381</strong>
        </div>
      </div>
      <div className="landing-hero-preview-chart">
        <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{ width: "100%", height: 80 }}>
          <defs>
            <linearGradient id="hero-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 60 L50 45 L100 52 L150 30 L200 38 L250 22 L300 28 L350 15 L400 20 L400 80 L0 80 Z" fill="url(#hero-grad)" />
          <path d="M0 60 L50 45 L100 52 L150 30 L200 38 L250 22 L300 28 L350 15 L400 20" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M0 48 L50 55 L100 42 L150 50 L200 45 L250 52 L300 40 L350 48 L400 42" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.7" />
        </svg>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/" className="landing-logo" aria-label="Funds Up"><img src="/funds-up-logo.svg" alt="Funds Up" /></Link>
        <div className="row-flex gap-3">
          <a href="#features" className="landing-nav-link">Features</a>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link className="btn primary btn-sm" to="/auth">Sign in</Link>
        </div>
      </nav>

      <main className="landing-main">
        <section className="landing-hero">
          <div>
            <span className="eyebrow">Personal finance, clarified</span>
            <h1>How wealth accumulators keep track of their finances</h1>
            <p>Link your accounts, tag your transactions, set budgets, and see the patterns in your money — all in one place.</p>
            <div className="row-flex gap-3 mt-4">
              <Link className="btn primary" to="/auth">Get started</Link>
              <a className="btn ghost" href="#features">Explore features</a>
            </div>
            <div className="landing-security">
              <strong>Bank-level security.</strong> Your data is encrypted at rest, protected in transit, and locked behind your MFA-secured account.
            </div>
          </div>
          <HeroPreview />
        </section>

        <div id="features">
          <InteractiveShowcase />
        </div>
      </main>

      <footer className="landing-footer">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <a href={`mailto:${supportEmail}`}>Support: {supportEmail}</a>
      </footer>
    </div>
  );
}
