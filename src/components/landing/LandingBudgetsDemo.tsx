import { Link } from "react-router-dom";

export default function LandingBudgetsDemo() {
  return (
    <>
      <header className="page-header landing-find-header">
        <h1>Keep your budgets in check</h1>
        <Link to="/auth" className="landing-cta">
          Connect My Bank
          <span className="landing-cta-arrow" aria-hidden>→</span>
        </Link>
      </header>
    </>
  );
}
