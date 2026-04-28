import { Link } from "react-router-dom";
import "./LandingPage.css";

const supportEmail = "support@demo.com";

function LogoMark() {
  return (
    <Link className="landing-logo" to="/l" aria-label="Funds Up landing page">
      <img src="/funds-up-logo.svg" alt="Funds Up" />
    </Link>
  );
}

function TransactionsPreview() {
  const rows = [
    ["Apr 24", "Whole Foods Market", "$86.41", "Groceries"],
    ["Apr 22", "Stripe Payout", "+$1,420.00", "Income"],
    ["Apr 21", "City Utilities", "$142.18", "Bills"],
    ["Apr 19", "Blue Bottle Coffee", "$7.80", "Dining"]
  ];

  return (
    <div className="feature-card feature-card-large">
      <div className="feature-card-header">
        <div>
          <span className="eyebrow">Transactions</span>
          <h3>Clean, categorized activity</h3>
        </div>
        <span className="status-pill">Bank synced</span>
      </div>
      <div className="mini-table" aria-label="Example categorized transactions">
        {rows.map(([date, name, amount, tag]) => (
          <div className="mini-table-row" key={name}>
            <span>{date}</span>
            <strong>{name}</strong>
            <span className={amount.startsWith("+") ? "money-positive" : ""}>{amount}</span>
            <span className="tag-chip">{tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PiePreview() {
  return (
    <div className="feature-card">
      <span className="eyebrow">Visualize Trends</span>
      <h3>Spending breakdowns</h3>
      <div className="pie-preview" aria-hidden="true" />
      <div className="legend-list">
        <span><i className="legend-blue" /> Bills</span>
        <span><i className="legend-orange" /> Dining</span>
        <span><i className="legend-green" /> Income</span>
      </div>
    </div>
  );
}

function FlowPreview() {
  return (
    <div className="feature-card">
      <span className="eyebrow">Flow of Funds</span>
      <h3>See money movement</h3>
      <svg className="flow-preview" viewBox="0 0 420 190" role="img" aria-label="Example flow of funds visualization">
        <path d="M55 45 C160 45 190 95 300 95" />
        <path d="M55 145 C160 145 210 115 300 115" />
        <path d="M300 95 C345 95 355 65 382 65" />
        <path d="M300 115 C345 115 355 145 382 145" />
        <rect x="28" y="24" width="48" height="48" rx="8" />
        <rect x="28" y="121" width="48" height="48" rx="8" />
        <rect x="276" y="78" width="48" height="54" rx="8" />
        <rect x="360" y="48" width="36" height="36" rx="8" />
        <rect x="360" y="128" width="36" height="36" rx="8" />
      </svg>
    </div>
  );
}

function TimelinePreview() {
  return (
    <div className="feature-card">
      <span className="eyebrow">Timeline</span>
      <h3>Track income and spending</h3>
      <svg className="timeline-preview" viewBox="0 0 420 170" role="img" aria-label="Example income and spending timeline">
        <path className="timeline-area" d="M20 124 L92 82 L164 96 L236 58 L308 72 L392 45 L392 132 L20 132 Z" />
        <path className="timeline-income" d="M20 124 L92 82 L164 96 L236 58 L308 72 L392 45" />
        <path className="timeline-spending" d="M20 96 L92 116 L164 84 L236 112 L308 92 L392 104" />
        <g>
          <circle cx="92" cy="82" r="4" />
          <circle cx="236" cy="58" r="4" />
          <circle cx="392" cy="45" r="4" />
        </g>
      </svg>
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <LogoMark />
        <div className="landing-nav-links">
          <a href={`mailto:${supportEmail}`}>Support</a>
          <Link to="/l/privacy">Privacy</Link>
          <Link className="btn btn-primary btn-sm" to="/auth">Sign in</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">Personal finance insights</span>
          <h1>Bank-connected financial clarity for serious money decisions.</h1>
          <p>
            Funds Up helps users connect financial accounts, review transactions, tag cash flow, and visualize trends in a simple secure dashboard.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/auth">Open sandbox app</Link>
            <a className="btn btn-outline-primary" href={`mailto:${supportEmail}`}>Contact support</a>
          </div>
          <div className="security-note">
            <strong>Bank-level security.</strong> Account connections use Plaid, sensitive data is protected in transit, and access is limited to authenticated users.
          </div>
        </div>
        <TransactionsPreview />
      </section>

      <section className="feature-grid" aria-label="Visual product features">
        <PiePreview />
        <FlowPreview />
        <TimelinePreview />
      </section>

      <section className="trust-section">
        <div>
          <span className="eyebrow">Built for responsible access</span>
          <h2>Simple, transparent, and ready for API review.</h2>
        </div>
        <p>
          Funds Up is a focused demo environment for personal finance organization. Questions can be sent to{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. Review the <Link to="/l/privacy">privacy policy</Link>.
        </p>
      </section>
    </main>
  );
}

export function PrivacyPolicyPage() {
  return (
    <main className="landing-page privacy-page">
      <nav className="landing-nav">
        <LogoMark />
        <div className="landing-nav-links">
          <Link to="/l">Landing</Link>
          <a href={`mailto:${supportEmail}`}>Support</a>
        </div>
      </nav>

      <article className="privacy-card">
        <span className="eyebrow">Privacy Policy</span>
        <h1>Funds Up Privacy Policy</h1>
        <p className="privacy-muted">Last updated April 28, 2026</p>

        <section>
          <h2>Overview</h2>
          <p>
            Funds Up is a personal finance application that helps users view transactions, organize tags, and understand financial trends. This policy is a placeholder for sandbox and partner review.
          </p>
        </section>
        <section>
          <h2>Information we handle</h2>
          <p>
            The app may process account, balance, transaction, institution, tag, and authentication information needed to provide the product experience. Sandbox data is fake.
          </p>
        </section>
        <section>
          <h2>Security</h2>
          <p>
            We use bank-level security practices, authenticated access, encrypted network connections, and trusted infrastructure providers including Plaid and Supabase.
          </p>
        </section>
        <section>
          <h2>Data use</h2>
          <p>
            Financial data is used to display account insights, categorize transactions, and power visualization tools. We do not sell personal financial data.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            For privacy or support questions, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
