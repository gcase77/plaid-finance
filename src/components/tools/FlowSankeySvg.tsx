import type { FlowSankeyModel } from "./flowOfFundsSankey";
import { layoutFlowSankey, linkRegionPath } from "./flowOfFundsSankey";

function lk(s: string, t: string) {
  return `${s}__${t}`;
}

function gradId(i: number) {
  return `sankey-grad-${i}`;
}

type Props = {
  model: FlowSankeyModel;
  width: number;
  height: number;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
};

export default function FlowSankeySvg({ model, width, height, selectedId, onSelectNode }: Props) {
  const { nodes, links } = layoutFlowSankey(model, width, height);
  const linkOpacity = (L: { source: string; target: string }) => {
    if (!selectedId) return 0.42;
    return L.source === selectedId || L.target === selectedId ? 0.5 : 0.1;
  };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="w-100" style={{ maxHeight: height }}>
      <defs>
        {links.map((L, i) => (
          <linearGradient key={lk(L.source, L.target)} id={gradId(i)} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={model.colors.get(L.source) ?? "#888"} stopOpacity={0.5} />
            <stop offset="100%" stopColor={model.colors.get(L.target) ?? "#888"} stopOpacity={0.5} />
          </linearGradient>
        ))}
      </defs>
      {links.map((L, i) => (
        <path
          key={lk(L.source, L.target)}
          d={linkRegionPath(L)}
          fill={`url(#${gradId(i)})`}
          stroke="none"
          opacity={linkOpacity(L)}
          style={{ mixBlendMode: "multiply" }}
        >
          <title>{`${L.source} → ${L.target}: $${L.value.toFixed(2)}`}</title>
        </path>
      ))}
      {nodes.map((n) => {
        const c = model.colors.get(n.id) ?? "#666";
        const active = selectedId === n.id;
        const faded = selectedId && !active ? 0.38 : 1;
        const tx = n.x + n.w + 4;
        return (
          <g key={n.id}>
            <rect
              x={n.x}
              y={n.y}
              width={n.w}
              height={n.h}
              rx={2}
              fill={c}
              stroke="var(--bs-body-bg)"
              strokeWidth={active ? 2 : 1}
              opacity={faded}
              style={{ cursor: "pointer" }}
              onClick={() => onSelectNode(active ? null : n.id)}
            />
            {n.h >= 12 && (
              <text
                x={Math.min(tx, width - 8)}
                y={n.y + n.h / 2}
                className="small"
                style={{ fill: "var(--bs-body-color)", fontSize: "9px", opacity: faded }}
                dominantBaseline="middle"
              >
                {n.label.length > 26 ? `${n.label.slice(0, 24)}…` : n.label}
              </text>
            )}
            <title>{`${n.label}: $${n.value.toFixed(2)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
