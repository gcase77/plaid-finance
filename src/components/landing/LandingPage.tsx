import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/" className="landing-logo" aria-label="Funds Up"><img src="/funds-up-logo.svg" alt="Funds Up" /></Link>
        <div className="row-flex gap-3">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link className="btn primary btn-sm" to="/auth">Sign in</Link>
        </div>
      </nav>
      <section className="landing-intro">
        <h1>Funds Up</h1>
        <a className="btn primary" href="#features">View features</a>
      </section>
      <section id="features" className="landing-features" aria-label="Features" />
    </div>
  );
}
