import { Link } from "react-router-dom";

export const supportEmail = "griffinecase7@gmail.com";

function TransactionsPreview() {
  const rows = [
    ["Apr 24", "Whole Foods Market", "$86.41", "Groceries"],
    ["Apr 22", "Stripe Payout", "+$1,420.00", "Income"],
    ["Apr 21", "City Utilities", "$142.18", "Bills"],
    ["Apr 19", "Blue Bottle Coffee", "$7.80", "Dining"]
  ];
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="between" style={{ padding: "var(--s4) var(--s5)", borderBottom: "1px solid var(--line)" }}>
        <div>
          <span className="chip chip-soft">Transactions</span>
          <h3 style={{ marginTop: 8 }}>Clean, categorized activity</h3>
        </div>
        <span className="chip chip-success">Bank synced</span>
      </div>
      <div>
        {rows.map(([date, name, amount, tag]) => {
          const positive = amount.startsWith("+");
          return (
            <div key={name} className="between" style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", fontSize: "0.92rem" }}>
              <span className="muted xs" style={{ width: 60 }}>{date}</span>
              <strong style={{ flex: 1, marginLeft: 12 }}>{name}</strong>
              <span style={{ width: 100, textAlign: "right", color: positive ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>{amount}</span>
              <span className="chip chip-soft" style={{ marginLeft: 12 }}>{tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PiePreview() {
  return (
    <div className="feature-card">
      <span className="eyebrow">Visualize Trends</span>
      <h3>Spending breakdowns</h3>
      <div style={{
        width: 180, height: 180, margin: "12px auto", borderRadius: "50%",
        background: "conic-gradient(var(--brand) 0 35%, var(--accent) 35% 60%, var(--success) 60% 82%, var(--warning) 82% 100%)",
        boxShadow: "inset 0 0 0 28px var(--surface), var(--shadow-1)"
      }} />
      <div className="row-flex flex-wrap gap-3 small muted">
        <span className="row-flex gap-1"><i style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--brand)" }} /> Bills</span>
        <span className="row-flex gap-1"><i style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)" }} /> Dining</span>
        <span className="row-flex gap-1"><i style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--success)" }} /> Income</span>
      </div>
    </div>
  );
}

function FlowPreview() {
  return (
    <div className="feature-card">
      <span className="eyebrow">Flow of Funds</span>
      <h3>See money movement</h3>
      <svg viewBox="0 0 420 190" style={{ width: "100%", padding: 8, background: "var(--surface-alt)", borderRadius: "var(--r-md)" }}>
        <path d="M55 45 C160 45 190 95 300 95" fill="none" stroke="var(--brand-soft)" strokeWidth={22} strokeLinecap="round" />
        <path d="M55 145 C160 145 210 115 300 115" fill="none" stroke="var(--brand-soft)" strokeWidth={22} strokeLinecap="round" />
        <path d="M300 95 C345 95 355 65 382 65" fill="none" stroke="var(--brand-soft)" strokeWidth={22} strokeLinecap="round" />
        <path d="M300 115 C345 115 355 145 382 145" fill="none" stroke="var(--brand-soft)" strokeWidth={22} strokeLinecap="round" />
        <rect x="28" y="24" width="48" height="48" rx="8" fill="var(--brand)" />
        <rect x="28" y="121" width="48" height="48" rx="8" fill="var(--brand)" />
        <rect x="276" y="78" width="48" height="54" rx="8" fill="var(--brand)" />
        <rect x="360" y="48" width="36" height="36" rx="8" fill="var(--accent)" />
        <rect x="360" y="128" width="36" height="36" rx="8" fill="var(--accent)" />
      </svg>
    </div>
  );
}

function TimelinePreview() {
  return (
    <div className="feature-card">
      <span className="eyebrow">Timeline</span>
      <h3>Track income & spending</h3>
      <svg viewBox="0 0 420 170" style={{ width: "100%", padding: 8, background: "var(--surface-alt)", borderRadius: "var(--r-md)" }}>
        <path d="M20 124 L92 82 L164 96 L236 58 L308 72 L392 45 L392 132 L20 132 Z" fill="var(--success-soft)" />
        <path d="M20 124 L92 82 L164 96 L236 58 L308 72 L392 45" fill="none" stroke="var(--success)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        <path d="M20 96 L92 116 L164 84 L236 112 L308 92 L392 104" fill="none" stroke="var(--danger)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

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
      <main className="landing-main">
        <section className="landing-hero">
          <div>
            <h1>How wealth accumulators keep track of their finances</h1>
            <p>Link your accounts, tag your transactions, set budgets, and see the patterns in your money.</p>
            <div className="row-flex gap-3 mt-4"><Link className="btn primary" to="/auth">Sign in</Link></div>
            <div className="landing-security"><strong>Bank-level security.</strong> Your data is encrypted at rest, protected in transit, and locked behind your MFA-secured account.</div>
          </div>
          <TransactionsPreview />
        </section>

        <section className="feature-grid" aria-label="Visual product features">
          <PiePreview />
          <FlowPreview />
          <TimelinePreview />
        </section>
      </main>
      <footer className="landing-footer">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <a href={`mailto:${supportEmail}`}>Support: {supportEmail}</a>
      </footer>
    </div>
  );
}
