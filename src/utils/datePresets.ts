export type DatePreset = "all" | "last7" | "last30" | "last365" | "lastMonth" | "lastYear";

const toInput = (d: Date) => 
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const buildDatePreset = (preset: DatePreset | string): { start: string; end: string } => {
  const now = new Date();
  if (preset === "all") return { start: "", end: "" };
  if (preset === "last7") {
    const s = new Date(now);
    s.setDate(now.getDate() - 6);
    return { start: toInput(s), end: toInput(now) };
  }
  if (preset === "last30") {
    const s = new Date(now);
    s.setDate(now.getDate() - 29);
    return { start: toInput(s), end: toInput(now) };
  }
  if (preset === "last365") {
    const s = new Date(now);
    s.setDate(now.getDate() - 364);
    return { start: toInput(s), end: toInput(now) };
  }
  if (preset === "lastMonth") {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(firstOfMonth);
    e.setDate(e.getDate() - 1);
    const s = new Date(e.getFullYear(), e.getMonth(), 1);
    return { start: toInput(s), end: toInput(e) };
  }
  if (preset === "lastYear") {
    const y = now.getFullYear() - 1;
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  return { start: "", end: "" };
};
