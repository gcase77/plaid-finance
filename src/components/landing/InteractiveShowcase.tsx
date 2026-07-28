import { useCallback, useEffect, useRef, useState } from "react";
import AccountBalancesPreview from "./demos/AccountBalancesPreview";
import BudgetRulesPreview from "./demos/BudgetRulesPreview";
import FlowDemo from "./demos/FlowDemo";
import SearchDemo from "./demos/SearchDemo";
import TaggingDemo from "./demos/TaggingDemo";
import TimelineDemo from "./demos/TimelineDemo";

type FeatureId = "search" | "tag" | "flow" | "timeline" | "budget" | "balances";

type Feature = {
  id: FeatureId;
  eyebrow: string;
  title: string;
  description: string;
  interactive: boolean;
  Demo: () => React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    id: "search",
    eyebrow: "Transactions",
    title: "Search and filter instantly",
    description: "Slice your history by name, merchant, date, amount, bank, category, or tag — with AND/OR logic across every filter.",
    interactive: true,
    Demo: SearchDemo
  },
  {
    id: "tag",
    eyebrow: "Tagging",
    title: "Organize spending your way",
    description: "Apply income, spending, and meta tags to transactions. Build a taxonomy that matches how you actually think about money.",
    interactive: true,
    Demo: TaggingDemo
  },
  {
    id: "flow",
    eyebrow: "Flow of funds",
    title: "See where money moves",
    description: "Sankey diagrams trace income through your tags to spending — click any node to drill into the underlying transactions.",
    interactive: true,
    Demo: FlowDemo
  },
  {
    id: "timeline",
    eyebrow: "Timeline",
    title: "Track income and spending over time",
    description: "Area and net-savings views reveal trends by week or month. Click any period to inspect the transactions behind it.",
    interactive: true,
    Demo: TimelineDemo
  },
  {
    id: "budget",
    eyebrow: "Budget rules",
    title: "Set targets that stick",
    description: "Flat-rate or percent-of-income budgets by tag, category, or all spending — with surplus and deficit rollover.",
    interactive: false,
    Demo: BudgetRulesPreview
  },
  {
    id: "balances",
    eyebrow: "Accounts",
    title: "All your balances in one place",
    description: "Checking, savings, and credit cards from every linked bank — with utilization bars for credit limits.",
    interactive: false,
    Demo: AccountBalancesPreview
  }
];

export default function InteractiveShowcase() {
  const [activeId, setActiveId] = useState<FeatureId>("search");
  const sectionRefs = useRef<Record<FeatureId, HTMLElement | null>>({} as Record<FeatureId, HTMLElement | null>);
  const scrollingRef = useRef(false);

  const scrollToFeature = useCallback((id: FeatureId) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    scrollingRef.current = true;
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => { scrollingRef.current = false; }, 800);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-feature-id") as FeatureId;
          if (id) setActiveId(id);
        }
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: [0, 0.3, 0.6, 1] }
    );

    for (const f of FEATURES) {
      const el = sectionRefs.current[f.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const activeFeature = FEATURES.find((f) => f.id === activeId) ?? FEATURES[0];
  const ActiveDemo = activeFeature.Demo;

  return (
    <section className="landing-showcase" aria-label="Product features">
      <div className="landing-showcase-header">
        <span className="eyebrow">Explore the app</span>
        <h2>Everything you need to understand your money</h2>
        <p className="muted">Scroll through features or pick one below. Interactive demos use the same components as the real app.</p>
      </div>

      <div className="landing-showcase-tabs" role="tablist" aria-label="Feature tabs">
        {FEATURES.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={activeId === f.id}
            className={`landing-showcase-tab${activeId === f.id ? " active" : ""}`}
            onClick={() => scrollToFeature(f.id)}
          >
            {f.eyebrow}
          </button>
        ))}
      </div>

      <div className="landing-showcase-layout">
        <div className="landing-showcase-sections">
          {FEATURES.map((f) => (
            <article
              key={f.id}
              id={`feature-${f.id}`}
              data-feature-id={f.id}
              className={`landing-showcase-section${activeId === f.id ? " active" : ""}`}
              ref={(el) => { sectionRefs.current[f.id] = el; }}
              onClick={() => scrollToFeature(f.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") scrollToFeature(f.id); }}
              role="button"
              tabIndex={0}
            >
              <span className="eyebrow">{f.eyebrow}</span>
              <h3>{f.title}</h3>
              <p className="muted">{f.description}</p>
              {f.interactive && <span className="landing-showcase-badge inline">Interactive</span>}
            </article>
          ))}
        </div>

        <div className="landing-showcase-sticky">
          <div className="landing-showcase-preview card">
            <div className="landing-showcase-preview-header">
              <span className="eyebrow">{activeFeature.eyebrow}</span>
              {activeFeature.interactive && <span className="chip chip-soft">Try it</span>}
            </div>
            <ActiveDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
