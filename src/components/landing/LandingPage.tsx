import { Link } from "react-router-dom";
import privacyMarkdown from "../../../privacy.md?raw";
import termsMarkdown from "../../../tos.md?raw";
import "./LandingPage.css";

const supportEmail = "griffinecase7@gmail.com";

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split("\n");
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2));
      continue;
    }

    flushList();
    paragraph.push(trimmed.replace(/ {2}$/, ""));
  }

  flushParagraph();
  flushList();
  return blocks;
};

function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g);
  return (
    <>
      {parts.map((part, index) => {
        if (/^https?:\/\//.test(part)) {
          return <a key={`${part}-${index}`} href={part}>{part}</a>;
        }
        if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(part)) {
          return <a key={`${part}-${index}`} href={`mailto:${part}`}>{part}</a>;
        }
        return part;
      })}
    </>
  );
}

function LogoMark() {
  return (
    <Link className="landing-logo" to="/l" aria-label="Funds Up landing page">
      <img src="/funds-up-logo.svg" alt="Funds Up" />
    </Link>
  );
}

function LegalDocumentPage({ markdown, label }: { markdown: string; label: string }) {
  const blocks = parseMarkdown(markdown);

  return (
    <main className="landing-page privacy-page">
      <nav className="landing-nav">
        <LogoMark />
        <div className="landing-nav-links">
          <Link to="/l">Landing</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <a href={`mailto:${supportEmail}`}>Support</a>
        </div>
      </nav>

      <article className="privacy-card legal-document" aria-label={label}>
        <span className="eyebrow">{label}</span>
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            if (block.level === 1) return <h1 key={index}>{block.text}</h1>;
            if (block.level === 2) return <h2 key={index}>{block.text}</h2>;
            return <h3 key={index}>{block.text}</h3>;
          }
          if (block.type === "list") {
            return (
              <ul key={index}>
                {block.items.map((item) => (
                  <li key={item}><MarkdownText text={item} /></li>
                ))}
              </ul>
            );
          }
          return <p key={index}><MarkdownText text={block.text} /></p>;
        })}
      </article>
    </main>
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
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
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
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. Review the <Link to="/privacy">privacy policy</Link> and{" "}
          <Link to="/terms">terms</Link>.
        </p>
      </section>
    </main>
  );
}

export function PrivacyPolicyPage() {
  return <LegalDocumentPage markdown={privacyMarkdown} label="Privacy Policy" />;
}

export function TermsPage() {
  return <LegalDocumentPage markdown={termsMarkdown} label="Terms of Service" />;
}
