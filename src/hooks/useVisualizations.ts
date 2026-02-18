import { useState, useRef } from "react";
import type { PieCategory, Txn } from "../components/types";
import { buildAuthHeaders, type RuntimeAuthMode } from "../lib/auth";

type UseVisualizationsReturn = {
  visualizeDateStart: string;
  setVisualizeDateStart: (v: string) => void;
  visualizeDateEnd: string;
  setVisualizeDateEnd: (v: string) => void;
  visualizeStatus: string;
  detailTitle: string;
  detailRows: Txn[];
  loadingCharts: boolean;
  incomeCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  spendingCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  sankeyRef: React.RefObject<HTMLDivElement | null>;
  refreshVisualizations: () => Promise<void>;
  clearVisualizations: () => void;
};

const palette = ["#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#d97706", "#0891b2", "#be123c", "#0f766e", "#4f46e5", "#a16207", "#475569", "#ea580c"];

export function useVisualizations(token: string | null, runtimeAuthMode: RuntimeAuthMode, isAuthed: boolean): UseVisualizationsReturn {
  const [visualizeDateStart, setVisualizeDateStart] = useState("");
  const [visualizeDateEnd, setVisualizeDateEnd] = useState("");
  const [visualizeStatus, setVisualizeStatus] = useState("No chart data loaded yet");
  const [detailTitle, setDetailTitle] = useState("Click a pie slice or Sankey category node to view transactions");
  const [detailRows, setDetailRows] = useState<Txn[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(false);

  const incomeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spendingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sankeyRef = useRef<HTMLDivElement | null>(null);
  const incomeChartRef = useRef<{ destroy: () => void } | null>(null);
  const spendingChartRef = useRef<{ destroy: () => void } | null>(null);

  const fetchWithAuth = async (url: string) => fetch(url, { headers: buildAuthHeaders(runtimeAuthMode, token) });

  const renderPie = (key: "income" | "spending", categories: PieCategory[]) => {
    if (!window.Chart) return;
    const canvas = key === "income" ? incomeCanvasRef.current : spendingCanvasRef.current;
    if (!canvas) return;
    const labels = categories.map((c) => c.category);
    const values = categories.map((c) => Number(c.amount || 0));
    const current = key === "income" ? incomeChartRef.current : spendingChartRef.current;
    if (current) current.destroy();
    const chart = new window.Chart(canvas, {
      type: "pie",
      data: {
        labels: labels.length ? labels : ["No data"],
        datasets: [{ data: values.length ? values : [1], backgroundColor: (labels.length ? labels : ["No data"]).map((_, i) => palette[i % palette.length]) }]
      },
      options: {
        plugins: { legend: { position: "bottom" } },
        onClick: (_event: unknown, elements: Array<{ index: number }>) => {
          if (!elements?.length || !labels.length) return;
          void loadVisualizationCategoryTransactions(key, labels[elements[0].index]);
        }
      }
    });
    if (key === "income") incomeChartRef.current = chart;
    else spendingChartRef.current = chart;
  };

  const renderSankey = (incomeCategories: PieCategory[], spendingCategories: PieCategory[]) => {
    const el = sankeyRef.current;
    if (!el || !window.Plotly) return;
    const inCats = incomeCategories.filter((c) => Number(c.amount) > 0);
    const outCats = spendingCategories.filter((c) => Number(c.amount) > 0);
    if (!inCats.length && !outCats.length) {
      window.Plotly.purge(el);
      return;
    }
    const labels = [...inCats.map((c) => `Income · ${c.category}`), "Cashflow", ...outCats.map((c) => `Spending · ${c.category}`)];
    const cashflowNode = inCats.length;
    const source: number[] = [];
    const target: number[] = [];
    const value: number[] = [];
    inCats.forEach((c, i) => {
      source.push(i);
      target.push(cashflowNode);
      value.push(Number(c.amount || 0));
    });
    outCats.forEach((c, i) => {
      source.push(cashflowNode);
      target.push(cashflowNode + 1 + i);
      value.push(Number(c.amount || 0));
    });
    window.Plotly.react(el, [{ type: "sankey", arrangement: "fixed", node: { label: labels }, link: { source, target, value } }], { margin: { l: 12, r: 12, t: 8, b: 8 } }, { displayModeBar: false, responsive: true });
    const anyEl = el as HTMLElement & { on?: (name: string, cb: (event: { points?: Array<{ label?: string; source?: number; target?: number }> }) => void) => void; removeAllListeners?: (name: string) => void };
    if (anyEl.removeAllListeners) anyEl.removeAllListeners("plotly_click");
    anyEl.on?.("plotly_click", (event) => {
      const point = event?.points?.[0];
      if (!point) return;
      let label = point.label || "";
      if (!label && Number.isInteger(point.target)) label = labels[point.target || 0] || "";
      if (!label && Number.isInteger(point.source)) label = labels[point.source || 0] || "";
      if (label.startsWith("Income · ")) void loadVisualizationCategoryTransactions("income", label.replace("Income · ", ""));
      if (label.startsWith("Spending · ")) void loadVisualizationCategoryTransactions("spending", label.replace("Spending · ", ""));
    });
  };

  const loadVisualizationCategoryTransactions = async (setType: "income" | "spending", category: string) => {
    const q = new URLSearchParams();
    q.set("set", setType);
    q.set("category", category);
    if (visualizeDateStart) q.set("startDate", visualizeDateStart);
    if (visualizeDateEnd) q.set("endDate", visualizeDateEnd);
    const data = await fetchWithAuth(`/api/transactions/visualize/details?${q.toString()}`).then((r) => r.json());
    setDetailTitle(`${setType === "income" ? "Income" : "Spending"} · ${category} (${data.count || 0} transactions)`);
    setDetailRows(Array.isArray(data.rows) ? data.rows : []);
  };

  const refreshVisualizations = async () => {
    if (!isAuthed) return;
    setLoadingCharts(true);
    setVisualizeStatus("Loading visualizations...");
    try {
      const q = new URLSearchParams();
      if (visualizeDateStart) q.set("startDate", visualizeDateStart);
      if (visualizeDateEnd) q.set("endDate", visualizeDateEnd);
      const data = await fetchWithAuth(`/api/transactions/visualize${q.toString() ? `?${q.toString()}` : ""}`).then((r) => r.json());
      if (data.error) {
        setVisualizeStatus(`Error: ${data.error}`);
        return;
      }
      const income = data.income?.categories || [];
      const spending = data.spending?.categories || [];
      renderPie("income", income);
      renderPie("spending", spending);
      renderSankey(income, spending);
      setDetailRows([]);
      setDetailTitle("Click a pie slice or Sankey category node to view transactions");
      setVisualizeStatus(`Income: ${data.income?.count || 0} tx (${Number(data.income?.total || 0).toFixed(2)}) · Spending: ${data.spending?.count || 0} tx (${Number(data.spending?.total || 0).toFixed(2)})`);
    } finally {
      setLoadingCharts(false);
    }
  };

  const clearVisualizations = () => {
    setDetailRows([]);
    setVisualizeStatus("No chart data loaded yet");
    if (incomeChartRef.current) incomeChartRef.current.destroy();
    if (spendingChartRef.current) spendingChartRef.current.destroy();
    if (sankeyRef.current && window.Plotly) window.Plotly.purge(sankeyRef.current);
  };

  return {
    visualizeDateStart,
    setVisualizeDateStart,
    visualizeDateEnd,
    setVisualizeDateEnd,
    visualizeStatus,
    detailTitle,
    detailRows,
    loadingCharts,
    incomeCanvasRef,
    spendingCanvasRef,
    sankeyRef,
    refreshVisualizations,
    clearVisualizations
  };
}
