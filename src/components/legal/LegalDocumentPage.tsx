import { Link } from "react-router-dom";
import privacyMarkdown from "../../content/legal/privacy.md?raw";
import termsMarkdown from "../../content/legal/terms.md?raw";
import "../landing/LandingPage.css";

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

function LegalDocumentPage({ markdown, label }: { markdown: string; label: string }) {
  const blocks = parseMarkdown(markdown);

  return (
    <main className="landing-page privacy-page">
      <nav className="landing-nav">
        <Link className="landing-logo" to="/l" aria-label="Funds Up landing page">
          <img src="/funds-up-logo.svg" alt="Funds Up" />
        </Link>
        <div className="landing-nav-links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
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

export function PrivacyPolicyPage() {
  return <LegalDocumentPage markdown={privacyMarkdown} label="Privacy Policy" />;
}

export function TermsPage() {
  return <LegalDocumentPage markdown={termsMarkdown} label="Terms of Service" />;
}
