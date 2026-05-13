import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/l" className="landing-logo" aria-label="Funds Up"><img src="/funds-up-logo.svg" alt="Funds Up" /></Link>
        <Link className="btn primary btn-sm" to="/auth">Sign in</Link>
      </nav>
      <main className="landing-main">
        <section className="landing-hero" style={{ alignItems: "flex-start" }}>
          <div>
            <span className="chip chip-soft">404</span>
            <h1 style={{ marginTop: 16 }}>Page doesn't exist</h1>
            <p>This route is not part of Funds Up. Head back to the dashboard or visit the landing page.</p>
            <div className="row-flex gap-3 mt-4">
              <Link className="btn primary" to="/">Go to dashboard</Link>
              <Link className="btn ghost" to="/l">View landing page</Link>
            </div>
          </div>
          <div className="card">
            <div className="between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}><span className="muted">Route lookup</span><strong className="text-brand">Missing</strong></div>
            <div className="between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}><span className="muted">Status</span><strong className="text-brand">404</strong></div>
            <div className="between" style={{ padding: "10px 0" }}><span className="muted">Next step</span><strong className="text-brand">Return home</strong></div>
          </div>
        </section>
      </main>
    </div>
  );
}
