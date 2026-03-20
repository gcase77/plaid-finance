import type { Tag, Txn } from "../types";
import { TAG_COLOR_PALETTE } from "../../utils/transactionUtils";
import {
  txnIncomeBucketFlowGroup,
  txnMetaFlowGroup,
  txnSpendingBucketFlowGroup,
  txnDetectedFlowGroup
} from "./visualizeTrendsUtils";

export const BRIDGE = "__flow_bridge__";

export type FlowGrouping = "detected" | "tags";

export type FlowSankeyNode = { id: string; label: string; column: number; value: number; transactions: Txn[] };
export type FlowSankeyLink = { source: string; target: string; value: number; transactions: Txn[] };

export type FlowSankeyModel = {
  nodes: FlowSankeyNode[];
  links: FlowSankeyLink[];
  colors: Map<string, string>;
  layerColumns: number;
  totalIncome: number;
  totalSpending: number;
};

type LM = Map<string, FlowSankeyLink>;

function lk(s: string, t: string) {
  return `${s}\0${t}`;
}

function addTxnUnique(arr: Txn[], tx: Txn) {
  if (tx.transaction_id && arr.some((x) => x.transaction_id === tx.transaction_id)) return;
  arr.push(tx);
}

function pushLm(lm: LM, list: FlowSankeyLink[], source: string, target: string, value: number, txns: Txn[]) {
  if (value <= 0) return;
  const k = lk(source, target);
  const prev = lm.get(k);
  if (prev) {
    prev.value += value;
    for (const t of txns) addTxnUnique(prev.transactions, t);
  } else {
    const row: FlowSankeyLink = { source, target, value, transactions: [...txns] };
    lm.set(k, row);
    list.push(row);
  }
}

function nodeColors(nodes: FlowSankeyNode[]): Map<string, string> {
  const byCol = new Map<number, FlowSankeyNode[]>();
  for (const n of nodes) {
    if (n.id === BRIDGE) continue;
    const arr = byCol.get(n.column) ?? [];
    arr.push(n);
    byCol.set(n.column, arr);
  }
  const m = new Map<string, string>();
  for (const [, arr] of byCol) {
    arr.sort((a, b) => b.value - a.value);
    arr.forEach((n, i) => m.set(n.id, TAG_COLOR_PALETTE[i % TAG_COLOR_PALETTE.length]));
  }
  m.set(BRIDGE, "#495057");
  return m;
}

function buildNodesFromLinks(links: FlowSankeyLink[], colOf: Map<string, number>, labelOf: Map<string, string>): FlowSankeyNode[] {
  const ids = new Set<string>();
  for (const L of links) {
    ids.add(L.source);
    ids.add(L.target);
  }
  const nodeValue = (id: string) => {
    const so = links.filter((l) => l.source === id).reduce((s, l) => s + l.value, 0);
    const si = links.filter((l) => l.target === id).reduce((s, l) => s + l.value, 0);
    return Math.max(so, si);
  };
  const nodeTx = (id: string) => {
    const arr: Txn[] = [];
    for (const L of links) {
      if (L.source === id || L.target === id) for (const t of L.transactions) addTxnUnique(arr, t);
    }
    return arr;
  };
  return [...ids]
    .map((id) => ({ id, label: labelOf.get(id) ?? id, column: colOf.get(id) ?? 0, value: nodeValue(id), transactions: nodeTx(id) }))
    .sort((a, b) => a.column - b.column || b.value - a.value);
}

export function buildFlowOfFundsModel(txns: Txn[], grouping: FlowGrouping, tagMap: Map<number, Tag>): FlowSankeyModel | null {
  const incomeT = txns.filter((t) => (t.amount ?? 0) < 0);
  const spendT = txns.filter((t) => (t.amount ?? 0) > 0);
  const totalIncome = incomeT.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
  const totalSpending = spendT.reduce((s, t) => s + (t.amount ?? 0), 0);
  if (totalIncome <= 0 && totalSpending <= 0) return null;

  const lm: LM = new Map();
  const links: FlowSankeyLink[] = [];
  const col = new Map<string, number>();
  const lab = new Map<string, string>();

  const bridgeValue = Math.max(totalIncome, totalSpending);
  lab.set(BRIDGE, "Bridge");

  if (grouping === "detected") {
    col.set(BRIDGE, 1);
    for (const t of incomeT) {
      const d = txnDetectedFlowGroup(t);
      if (!d) continue;
      const id = `d:i:${d.key}`;
      lab.set(id, d.label);
      col.set(id, 0);
      pushLm(lm, links, id, BRIDGE, Math.abs(t.amount ?? 0), [t]);
    }
    for (const t of spendT) {
      const d = txnDetectedFlowGroup(t);
      if (!d) continue;
      const id = `d:s:${d.key}`;
      lab.set(id, d.label);
      col.set(id, 2);
      pushLm(lm, links, BRIDGE, id, t.amount ?? 0, [t]);
    }
    const nodes = buildNodesFromLinks(links, col, lab);
    const bn = nodes.find((n) => n.id === BRIDGE);
    if (bn) bn.value = bridgeValue;
    return { nodes, links, colors: nodeColors(nodes), layerColumns: 3, totalIncome, totalSpending };
  }

  /* 5-layer: income meta → income buckets → bridge → spending buckets → spending meta */
  col.set(BRIDGE, 2);

  for (const t of incomeT) {
    const m = txnMetaFlowGroup(t, tagMap);
    const b = txnIncomeBucketFlowGroup(t, tagMap);
    if (!b) continue;
    const v = Math.abs(t.amount ?? 0);
    const mid = `m:i:${m.key}`;
    const bid = `b:i:${b.key}`;
    lab.set(mid, m.label);
    lab.set(bid, b.label);
    col.set(mid, 0);
    col.set(bid, 1);
    pushLm(lm, links, mid, bid, v, [t]);
  }

  const bucketInIds = [...new Set(links.filter((l) => l.target.startsWith("b:i:")).map((l) => l.target))];
  for (const bid of bucketInIds) {
    const segs = links.filter((l) => l.target === bid);
    const v = segs.reduce((s, l) => s + l.value, 0);
    const tx = segs.flatMap((l) => l.transactions);
    pushLm(lm, links, bid, BRIDGE, v, tx);
  }

  for (const t of spendT) {
    const b = txnSpendingBucketFlowGroup(t, tagMap);
    const m = txnMetaFlowGroup(t, tagMap);
    if (!b) continue;
    const v = t.amount ?? 0;
    const bid = `b:s:${b.key}`;
    const mid = `m:s:${m.key}`;
    lab.set(bid, b.label);
    lab.set(mid, m.label);
    col.set(bid, 3);
    col.set(mid, 4);
    pushLm(lm, links, bid, mid, v, [t]);
  }

  const bucketOutIds = [...new Set(links.filter((l) => l.source.startsWith("b:s:")).map((l) => l.source))];
  for (const bid of bucketOutIds) {
    const segs = links.filter((l) => l.source === bid);
    const v = segs.reduce((s, l) => s + l.value, 0);
    const tx = segs.flatMap((l) => l.transactions);
    pushLm(lm, links, BRIDGE, bid, v, tx);
  }

  const nodes = buildNodesFromLinks(links, col, lab);
  const bn = nodes.find((n) => n.id === BRIDGE);
  if (bn) bn.value = bridgeValue;
  return { nodes, links, colors: nodeColors(nodes), layerColumns: 5, totalIncome, totalSpending };
}

export type LaidOutNode = FlowSankeyNode & { x: number; y: number; w: number; h: number };
export type LaidOutLink = FlowSankeyLink & { sy0: number; sy1: number; ty0: number; ty1: number; x0: number; x1: number };

export function layoutFlowSankey(model: FlowSankeyModel, width: number, height: number): { nodes: LaidOutNode[]; links: LaidOutLink[] } {
  const padX = 8;
  const padY = 12;
  const nodeW = 14;
  const labelGutter = 148;
  const innerW = width - 2 * padX - labelGutter;
  const innerH = height - 2 * padY;
  const maxCol = Math.max(0, model.layerColumns - 1);
  const colGap = maxCol ? innerW / maxCol : innerW;

  const byCol = new Map<number, FlowSankeyNode[]>();
  for (const n of model.nodes) {
    const arr = byCol.get(n.column) ?? [];
    arr.push(n);
    byCol.set(n.column, arr);
  }

  const laidMap = new Map<string, LaidOutNode>();
  const laidNodes: LaidOutNode[] = [];

  for (const [ci, arr] of [...byCol.entries()].sort((a, b) => a[0] - b[0])) {
    const sum = arr.reduce((s, n) => s + Math.max(n.value, 1e-6), 0);
    const gapBetween = 3;
    const totalGap = Math.max(0, arr.length - 1) * gapBetween;
    const usable = innerH - totalGap;
    const sortedCol = [...arr].sort((a, b) => b.value - a.value);
    let rawHs = sortedCol.map((n) => {
      const frac = Math.max(n.value, 0) / sum;
      const minH = n.value > 0 ? 4 : 2;
      return Math.max(frac * usable, minH);
    });
    const rawSum = rawHs.reduce((s, h) => s + h, 0);
    if (rawSum > Math.max(1, usable))
      rawHs = rawHs.map((h) => (h * usable) / rawSum);
    let y = padY;
    const x = padX + ci * colGap;
    for (const [i, n] of sortedCol.entries()) {
      const h = rawHs[i];
      const ln: LaidOutNode = { ...n, x, y, w: nodeW, h };
      laidNodes.push(ln);
      laidMap.set(n.id, ln);
      y += h + gapBetween;
    }
  }

  const outBy = new Map<string, FlowSankeyLink[]>();
  const inBy = new Map<string, FlowSankeyLink[]>();
  for (const L of model.links) {
    outBy.set(L.source, [...(outBy.get(L.source) ?? []), L]);
    inBy.set(L.target, [...(inBy.get(L.target) ?? []), L]);
  }
  for (const [, arr] of outBy) arr.sort((a, b) => b.value - a.value);
  for (const [, arr] of inBy) {
    arr.sort((a, b) => {
      const ya = laidMap.get(a.source)?.y ?? 0;
      const yb = laidMap.get(b.source)?.y ?? 0;
      return ya - yb;
    });
  }

  const bridgeNode = laidMap.get(BRIDGE);
  const bridgeValue = Math.max(model.totalIncome, model.totalSpending) || 1;
  const bridgeIncomeH = bridgeNode ? (model.totalIncome / bridgeValue) * bridgeNode.h : 0;
  const bridgeSpendH = bridgeNode ? (model.totalSpending / bridgeValue) * bridgeNode.h : 0;

  const assignOut = (nid: string, fillH?: number) => {
    const node = laidMap.get(nid);
    const outs = outBy.get(nid) ?? [];
    if (!node || !outs.length) return;
    const avail = fillH ?? node.h;
    const tot = outs.reduce((s, l) => s + l.value, 0) || 1;
    let cursor = node.y;
    for (const L of outs) {
      const linkH = (L.value / tot) * avail;
      (L as LaidOutLink).sy0 = cursor;
      (L as LaidOutLink).sy1 = cursor + linkH;
      cursor += linkH;
    }
  };

  const assignIn = (nid: string, fillH?: number) => {
    const node = laidMap.get(nid);
    const ins = inBy.get(nid) ?? [];
    if (!node || !ins.length) return;
    const avail = fillH ?? node.h;
    const tot = ins.reduce((s, l) => s + l.value, 0) || 1;
    let cursor = node.y;
    for (const L of ins) {
      const linkH = (L.value / tot) * avail;
      (L as LaidOutLink).ty0 = cursor;
      (L as LaidOutLink).ty1 = cursor + linkH;
      cursor += linkH;
    }
  };

  for (const n of model.nodes) {
    if (n.id === BRIDGE) {
      assignIn(n.id, bridgeIncomeH);
      assignOut(n.id, bridgeSpendH);
    } else {
      assignOut(n.id);
      assignIn(n.id);
    }
  }

  const laidLinks: LaidOutLink[] = model.links.map((L) => {
    const a = laidMap.get(L.source);
    const b = laidMap.get(L.target);
    const x0 = (a?.x ?? 0) + (a?.w ?? nodeW);
    const x1 = b?.x ?? 0;
    return {
      ...L,
      sy0: (L as LaidOutLink).sy0 ?? 0,
      sy1: (L as LaidOutLink).sy1 ?? 0,
      ty0: (L as LaidOutLink).ty0 ?? 0,
      ty1: (L as LaidOutLink).ty1 ?? 0,
      x0,
      x1
    };
  });

  return { nodes: laidNodes, links: laidLinks };
}

export function linkRegionPath(L: LaidOutLink): string {
  const { x0, x1, sy0, sy1, ty0, ty1 } = L;
  const mx = (x0 + x1) / 2;
  return `M ${x0} ${sy0} C ${mx} ${sy0} ${mx} ${ty0} ${x1} ${ty0} L ${x1} ${ty1} C ${mx} ${ty1} ${mx} ${sy1} ${x0} ${sy1} Z`;
}
