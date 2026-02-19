import { buildDatePreset, type DatePreset } from "../../utils/datePresets";

export const DATE_RANGE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last365", label: "Last 365 days" },
  { value: "lastMonth", label: "Last month" },
  { value: "lastYear", label: "Last year" }
];

export function formatDateRangeLabel(dateStart: string, dateEnd: string): string {
  if (!dateStart && !dateEnd) return "All time";
  if (dateStart && dateEnd) return `${dateStart} – ${dateEnd}`;
  return dateStart ? `From ${dateStart}` : `Until ${dateEnd}`;
}

export function matchDatePreset(dateStart: string, dateEnd: string): DatePreset | null {
  for (const { value } of DATE_RANGE_PRESETS) {
    const { start, end } = buildDatePreset(value);
    if (start === dateStart && end === dateEnd) return value;
  }
  return null;
}
