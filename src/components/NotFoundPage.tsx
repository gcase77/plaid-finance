import { Link } from "react-router-dom";
import "./landing/LandingPage.css";
import "./NotFoundPage.css";

export default function NotFoundPage() {
  return (
    <main className="landing-page not-found-page">
      <nav className="landing-nav">
        <Link className="landing-logo" to="/l" aria-label="Funds Up landing page">
          <img src="/funds-up-logo.svg" alt="Funds Up" />
        </Link>
        <div className="landing-nav-links">
          <Link className="btn btn-primary btn-sm" to="/auth">Sign in</Link>
        </div>
      </nav>

      <section className="not-found-panel" aria-labelledby="not-found-title">
        <div>
          <span className="eyebrow">404</span>
          <h1 id="not-found-title">Page doesn't exist</h1>
          <p>
            This route is not part of Funds Up. Head back to the dashboard or start from the public landing page.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/">Go to dashboard</Link>
            <Link className="btn btn-outline-primary" to="/l">View landing page</Link>
          </div>
        </div>

        <div className="not-found-visual" aria-hidden="true">
          <div className="not-found-ledger-row">
            <span>Route lookup</span>
            <strong>Missing</strong>
          </div>
          <div className="not-found-ledger-row">
            <span>Status</span>
            <strong>404</strong>
          </div>
          <div className="not-found-ledger-row">
            <span>Next step</span>
            <strong>Return home</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
