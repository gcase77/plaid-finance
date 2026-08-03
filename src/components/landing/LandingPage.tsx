import { Link } from "react-router-dom";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import LandingBudgetsDemo from "./LandingBudgetsDemo";
import LandingTransactionsDemo from "./LandingTransactionsDemo";
import LandingVisualizeDemo from "./LandingVisualizeDemo";

const HERO_ARROW =
  "M4 219L77 152L174 243L278 134L258 111L359 90L339 194L317 174L177 319L75 226L4 291Z";
// The <svg> viewBox only wraps the drawn path (355 x 229), but the container box
// keeps a taller 355:275 aspect ratio so preserveAspectRatio="xMidYMax meet" can
// bottom-align it. That leaves empty space above the path, so the glow's percentage
// mapping must use the container's full aspect ratio, not the viewBox's, or it drifts
// off the line (worst near the top of the arrow).
const VIEW = { x: 4, y: 90 - (275 - 229), w: 355, h: 275 };

function HeroArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="4 90 355 229" preserveAspectRatio="xMidYMax meet" overflow="visible" fill="none" aria-hidden>
      <path d={HERO_ARROW} stroke="currentColor" strokeWidth={3.25} strokeLinejoin="miter" strokeMiterlimit={2} strokeLinecap="square" />
    </svg>
  );
}

type GlowPhase = "idle" | "shooting" | "ready";

export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<GlowPhase>("idle");

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("ready");
      return;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", HERO_ARROW);
    const len = path.getTotalLength();
    const delay = 500;
    const duration = 1450;
    const t0 = performance.now() + delay;
    let raf = 0;
    let started = false;
    let cancelled = false;

    const frame = (now: number) => {
      if (cancelled) return;
      if (now < t0) {
        raf = requestAnimationFrame(frame);
        return;
      }
      if (!started) {
        started = true;
        setPhase("shooting");
      }
      const t = Math.min(1, (now - t0) / duration);
      const pt = path.getPointAtLength(t * len);
      hero.style.setProperty("--glow-x", `${((pt.x - VIEW.x) / VIEW.w) * 100}%`);
      hero.style.setProperty("--glow-y", `${((pt.y - VIEW.y) / VIEW.h) * 100}%`);
      if (t < 1) raf = requestAnimationFrame(frame);
      else setPhase("ready");
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  function trackHeroGlow(e: MouseEvent<HTMLDivElement>) {
    if (phase !== "ready") return;
    const mark = heroRef.current?.querySelector<HTMLElement>(".landing-hero-mark");
    if (!mark || !heroRef.current) return;
    const r = mark.getBoundingClientRect();
    heroRef.current.style.setProperty("--glow-x", `${((e.clientX - r.left) / r.width) * 100}%`);
    heroRef.current.style.setProperty("--glow-y", `${((e.clientY - r.top) / r.height) * 100}%`);
  }

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
      <section className="landing-intro" onMouseMove={trackHeroGlow}>
        <div
          className={`landing-hero-title${phase !== "idle" ? ` landing-hero-title--${phase}` : ""}`}
          ref={heroRef}
        >
          <HeroArrow className="landing-hero-mark" />
          <HeroArrow className="landing-hero-mark landing-hero-mark-glow" />
          <h1>Funds Up</h1>
        </div>
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
      <footer className="landing-footer">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <a href="mailto:griffinecase7@gmail.com">Support: griffinecase7@gmail.com</a>
      </footer>
    </div>
  );
}
