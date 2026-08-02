import { Link } from "react-router-dom";
import LandingBudgetsDemo from "./LandingBudgetsDemo";
import LandingTransactionsDemo from "./LandingTransactionsDemo";
import LandingVisualizeDemo from "./LandingVisualizeDemo";

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
        <a className="landing-cta" href="#find-transactions">
          View features
          <span className="landing-cta-arrow landing-cta-arrow-down" aria-hidden>↓</span>
        </a>
      </section>
      <section id="find-transactions" className="landing-features" aria-label="Find transactions">
        <LandingTransactionsDemo />
      </section>
      <section id="visualize-trends" className="landing-features landing-features-end" aria-label="Visualize trends">
        <LandingVisualizeDemo />
      </section>
      <section id="budgets" className="landing-features" aria-label="Keep your budgets in check">
        <LandingBudgetsDemo />
      </section>
    </div>
  );
}
