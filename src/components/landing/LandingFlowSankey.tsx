import { useState } from "react";
import { BRIDGE, type FlowSankeyModel, layoutFlowSankey, linkRegionPath } from "../tools/flowOfFundsSankey";

const HEADER_H = 36;
const lk = (s: string, t: string) => `${s}__${t}`;
const gradId = (i: number) => `landing-sankey-grad-${i}`;
const fmtMoney = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type Props = {
  model: FlowSankeyModel;
  width: number;
  height: number;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
};

export default function LandingFlowSankey({ model, width, height, selectedId, onSelectNode }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const layH = Math.max(120, height - HEADER_H);
  const { nodes, links } = layoutFlowSankey(model, width, layH);
  const linkOpacity = (L: { source: string; target: string }) => {
    const focus = hoverId ?? selectedId;
    if (!focus) return 0.42;
    return L.source === focus || L.target === focus ? 0.55 : 0.1;
  };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", maxHeight: height }}>
      <text x={12} y={22} textAnchor="start" fontSize="12" fontWeight="600" fill="var(--ink)">
        Income {fmtMoney(model.totalIncome)}
      </text>
      <text x={width - 12} y={22} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--ink)">
        Spending {fmtMoney(model.totalSpending)}
      </text>
      <g transform={`translate(0 ${HEADER_H})`}>
        <defs>
          {links.map((L, i) => (
            <linearGradient key={lk(L.source, L.target)} id={gradId(i)} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={model.colors.get(L.source) ?? "var(--ink-muted)"} stopOpacity={0.5} />
              <stop offset="100%" stopColor={model.colors.get(L.target) ?? "var(--ink-muted)"} stopOpacity={0.5} />
            </linearGradient>
          ))}
        </defs>
        <g className="sankey-link-layer">
          {links.map((L, i) => (
            <path key={lk(L.source, L.target)} d={linkRegionPath(L)} fill={`url(#${gradId(i)})`} stroke="none" opacity={linkOpacity(L)} />
          ))}
        </g>
        {nodes.map((n) => {
          const c = model.colors.get(n.id) ?? "var(--ink-muted)";
          const isBridge = n.id === BRIDGE;
          const active = !isBridge && selectedId === n.id;
          const hovered = !isBridge && hoverId === n.id;
          const focus = hoverId ?? selectedId;
          const faded = !isBridge && focus && !active && !hovered ? 0.38 : 1;
          const tx = n.x + n.w + 4;
          const hitPad = 10;
          return (
            <g key={n.id} className={isBridge ? undefined : "landing-viz-hit"}>
              <rect
                x={n.x} y={n.y} width={n.w} height={n.h} rx={2}
                fill={c} stroke={active || hovered ? "var(--ink)" : "var(--surface)"}
                strokeWidth={active || hovered ? 2 : 1} opacity={faded}
                style={{ transition: "opacity 120ms ease, stroke-width 120ms ease" }}
              />
              {n.h >= 12 && (
                <text
                  x={Math.min(tx, width - 8)} y={n.y + n.h / 2}
                  className="small"
                  style={{ fill: "var(--ink)", fontSize: "9px", opacity: faded, fontWeight: active || hovered ? 700 : 400 }}
                  dominantBaseline="middle"
                >
                  {n.label.length > 26 ? `${n.label.slice(0, 24)}…` : n.label}
                </text>
              )}
              {!isBridge && (
                <rect
                  x={n.x - hitPad} y={n.y - 4} width={n.w + hitPad * 2 + 120} height={Math.max(n.h + 8, 22)}
                  fill="transparent" style={{ cursor: "pointer" }}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHoverId(n.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => onSelectNode(active ? null : n.id)}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
