import { Link } from "react-router-dom";
import privacyMarkdown from "../../content/legal/privacy.md?raw";
import termsMarkdown from "../../content/legal/terms.md?raw";

type Block = { type: "heading"; level: number; text: string } | { type: "paragraph"; text: string } | { type: "list"; items: string[] };

function parseMarkdown(md: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [], items: string[] = [];
  const flushP = () => { if (para.length) { out.push({ type: "paragraph", text: para.join(" ") }); para = []; } };
  const flushL = () => { if (items.length) { out.push({ type: "list", items }); items = []; } };
  for (const line of md.split("\n")) {
    const t = line.trim();
    if (!t) { flushP(); flushL(); continue; }
    const h = /^(#{1,3})\s+(.+)$/.exec(t);
    if (h) { flushP(); flushL(); out.push({ type: "heading", level: h[1].length, text: h[2] }); continue; }
    if (t.startsWith("- ")) { flushP(); items.push(t.slice(2)); continue; }
    flushL();
    para.push(t.replace(/ {2}$/, ""));
  }
  flushP(); flushL();
  return out;
}

function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g);
  return <>{parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) return <a key={`${part}-${i}`} href={part}>{part}</a>;
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(part)) return <a key={`${part}-${i}`} href={`mailto:${part}`}>{part}</a>;
    return part;
  })}</>;
}

function LegalDocumentPage({ markdown, label }: { markdown: string; label: string }) {
  const blocks = parseMarkdown(markdown);
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/l" className="landing-logo" aria-label="Funds Up"><img src="/funds-up-logo.svg" alt="Funds Up" /></Link>
        <div className="row-flex gap-3"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
      </nav>
      <main className="landing-main">
        <article className="card" style={{ padding: "var(--s6) var(--s7)" }} aria-label={label}>
          <span className="chip chip-soft">{label}</span>
          {blocks.map((b, i) => {
            if (b.type === "heading") {
              if (b.level === 1) return <h1 key={i} style={{ marginTop: 16 }}>{b.text}</h1>;
              if (b.level === 2) return <h2 key={i} style={{ marginTop: 24 }}>{b.text}</h2>;
              return <h3 key={i} style={{ marginTop: 16 }}>{b.text}</h3>;
            }
            if (b.type === "list") return <ul key={i}>{b.items.map((it) => <li key={it}><MarkdownText text={it} /></li>)}</ul>;
            return <p key={i} className="mb-3 muted" style={{ lineHeight: 1.7 }}><MarkdownText text={b.text} /></p>;
          })}
        </article>
      </main>
    </div>
  );
}

export function PrivacyPolicyPage() { return <LegalDocumentPage markdown={privacyMarkdown} label="Privacy Policy" />; }
export function TermsPage() { return <LegalDocumentPage markdown={termsMarkdown} label="Terms of Service" />; }
