import type { ReactNode } from "react";
import type { TrendPieSlice } from "../tools/visualizeTrendsUtils";

const CX = 100, CY = 100, R = 90;

function pieSlicePath(a0: number, a1: number): string {
  if (a1 - a0 >= 359.99) return `M ${CX} ${CY} m 0 ${-R} a ${R} ${R} 0 1 1 0 ${2 * R} a ${R} ${R} 0 1 1 0 ${-2 * R}`;
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x0 = CX + R * Math.cos(rad(a0)); const y0 = CY + R * Math.sin(rad(a0));
  const x1 = CX + R * Math.cos(rad(a1)); const y1 = CY + R * Math.sin(rad(a1));
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
}

export function TrendPieSvg({ slices, colors, selectedKey, onSelect }: {
  slices: TrendPieSlice[]; colors: Map<string, string>; selectedKey: string | null; onSelect: (s: TrendPieSlice) => void;
}) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) {
    return (
      <svg viewBox="0 0 200 200" style={{ width: "100%", maxHeight: 220 }}>
        <circle cx={CX} cy={CY} r={R} fill="var(--surface-alt)" stroke="var(--line)" />
        <text x={CX} y={CY} textAnchor="middle" className="small" fill="var(--ink-muted)">No data</text>
      </svg>
    );
  }
  const sweeps = slices.map((sl) => (sl.amount / total) * 360);
  const starts: number[] = sweeps.reduce<number[]>((acc, s, i) => [...acc, (acc[i - 1] ?? -90) + (i === 0 ? 0 : sweeps[i - 1])], []);
  const paths: ReactNode[] = slices.map((sl, i) => {
    const a0 = starts[i];
    const a1 = a0 + sweeps[i];
    const c = colors.get(sl.key) ?? "var(--ink-muted)";
    const dim = selectedKey && selectedKey !== sl.key;
    return (
      <path key={sl.key} d={pieSlicePath(a0, a1)} fill={c} opacity={dim ? 0.35 : 1} stroke="var(--surface)" strokeWidth={1} style={{ cursor: "pointer" }} onClick={() => onSelect(sl)}>
        <title>{`${sl.label}: $${sl.amount.toFixed(2)}`}</title>
      </path>
    );
  });
  return <svg viewBox="0 0 200 200" style={{ width: "100%", maxHeight: 220 }}>{paths}</svg>;
}

export function TrendPieLegend({ slices, colors, selectedKey, onSelect }: {
  slices: TrendPieSlice[]; colors: Map<string, string>; selectedKey: string | null; onSelect: (s: TrendPieSlice) => void;
}) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (!slices.length) return null;
  return (
    <ul className="viz-pie-legend" style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
      {slices.map((sl) => {
        const pct = total > 0 ? (100 * sl.amount) / total : 0;
        const c = colors.get(sl.key) ?? "var(--ink-muted)";
        const active = selectedKey === sl.key;
        return (
          <li key={sl.key} style={{ breakInside: "avoid", marginBottom: 4 }}>
            <button type="button" className="btn link btn-sm viz-pie-legend-row" style={{ fontWeight: active ? 700 : 500, color: "inherit" }} onClick={() => onSelect(sl)}>
              <span className="viz-pie-legend-swatch" style={{ background: c }} aria-hidden />
              <span className="viz-pie-legend-label">{sl.label}</span>
              <span className="viz-pie-legend-pct muted">{pct.toFixed(0)}%</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function TrendPiePanel(props: {
  slices: TrendPieSlice[]; colors: Map<string, string>; selectedKey: string | null; onSelect: (s: TrendPieSlice) => void;
}) {
  return <><TrendPieSvg {...props} /><TrendPieLegend {...props} /></>;
}
