import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Font = { name: string; vibe: string; weights?: string };

const FONTS: Font[] = [
  { name: "Fraunces", vibe: "Your pick — soft optical serif" },
  { name: "Playfair Display", vibe: "High-contrast display serif" },
  { name: "Libre Baskerville", vibe: "Heavy classical weight" },
  { name: "Cormorant Garamond", vibe: "Tall elegant display" },
  { name: "Bodoni Moda", vibe: "Fashion Didone punch" },
  { name: "DM Serif Display", vibe: "Thick slab-ish display" },
  { name: "Abril Fatface", vibe: "Fat display — max presence", weights: "400" },
  { name: "Ultra", vibe: "Ultra-heavy slab", weights: "400" },
  { name: "Anton", vibe: "Condensed all-caps energy", weights: "400" },
  { name: "Bebas Neue", vibe: "Wide condensed display", weights: "400" },
  { name: "Oswald", vibe: "Industrial condensed" },
  { name: "Archivo Black", vibe: "Extra-black grotesque", weights: "400" },
  { name: "Black Ops One", vibe: "Stencil military weight", weights: "400" },
  { name: "Teko", vibe: "Compressed athletic" },
  { name: "Russo One", vibe: "Bold geometric block", weights: "400" },
  { name: "Passion One", vibe: "Rounded heavy display" },
  { name: "Righteous", vibe: "Retro display strength", weights: "400" },
  { name: "Alfa Slab One", vibe: "Egyptian slab power", weights: "400" },
  { name: "Patua One", vibe: "Solid slab serif", weights: "400" },
  { name: "Zilla Slab", vibe: "Contemporary slab" },
  { name: "Roboto Slab", vibe: "Mechanical slab" },
  { name: "Bitter", vibe: "Sturdy text serif that scales" },
  { name: "Merriweather", vibe: "Heavy readable serif" },
  { name: "Lora", vibe: "Calligraphic serif strength" },
  { name: "Spectral", vibe: "Newsroom authority" },
  { name: "Source Serif 4", vibe: "Serious editorial" },
  { name: "EB Garamond", vibe: "Renaissance weight" },
  { name: "Cinzel", vibe: "Stone-carved caps" },
  { name: "Oranienbaum", vibe: "Didone elegance", weights: "400" },
  { name: "Yeseva One", vibe: "Decorative display serif", weights: "400" },
];

const HREF =
  "https://fonts.googleapis.com/css2?" +
  FONTS.map((f) => `family=${encodeURIComponent(f.name)}:wght@${f.weights ?? "500;600;700;800"}`).join("&") +
  "&display=swap";

export default function FontPickerPage() {
  const [picked, setPicked] = useState("Fraunces");

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = HREF;
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, []);

  return (
    <div className="landing" style={{ paddingBottom: "4rem" }}>
      <nav className="landing-nav">
        <Link to="/" className="landing-logo" aria-label="Funds Up"><img src="/funds-up-logo.svg" alt="Funds Up" /></Link>
        <span className="muted" style={{ fontSize: "0.9rem" }}>More powerful set · click to select</span>
      </nav>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 clamp(1rem,4vw,2rem)" }}>
        <p className="muted" style={{ marginBottom: "1.5rem", fontSize: "0.95rem" }}>
          Picked: <strong style={{ color: "var(--ink)", fontFamily: `"${picked}", serif` }}>{picked}</strong>
          {" · "}
          <code style={{ fontSize: "0.85em" }}>font-family: "{picked}", …</code>
        </p>
        {FONTS.map((f) => {
          const active = picked === f.name;
          return (
            <button
              key={f.name}
              type="button"
              onClick={() => setPicked(f.name)}
              style={{
                display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`,
                background: active ? "var(--brand-soft)" : "var(--surface)",
                borderRadius: "var(--r-md)", padding: "1.25rem 1.5rem", marginBottom: "0.75rem",
                color: "inherit", font: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.35rem", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                <span style={{ fontWeight: 650, color: active ? "var(--brand)" : "var(--ink)" }}>{f.name}</span>
                <span>{f.vibe}</span>
              </div>
              <div style={{ fontFamily: `"${f.name}", serif`, fontSize: "clamp(2.4rem, 7vw, 4.5rem)", fontWeight: 750, letterSpacing: "-0.04em", lineHeight: 0.95, color: "var(--ink)" }}>
                Funds Up
              </div>
              <div style={{ fontFamily: `"${f.name}", serif`, fontSize: "1.7rem", fontWeight: 700, letterSpacing: "-0.01em", marginTop: "0.75rem", color: "var(--ink)" }}>
                Find transactions
              </div>
              <div style={{ fontFamily: `"${f.name}", serif`, fontSize: "0.95rem", fontWeight: 500, color: "var(--ink-muted)", marginTop: "0.35rem" }}>
                View features · Sign in · Visualize trends
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
