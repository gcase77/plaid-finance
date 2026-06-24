type Nettable = { netting_group?: string | null; amount?: number | null };

/**
 * Collapses each netting group into a single synthetic transaction: the
 * largest-magnitude leg (anchor) carries the group's summed (net) amount.
 * Non-grouped transactions pass through unchanged.
 */
export function collapseNettingGroups<T extends Nettable>(txns: T[]): T[] {
  const groups = new Map<string, T[]>();
  const out: T[] = [];
  for (const t of txns) {
    if (t.netting_group) {
      const arr = groups.get(t.netting_group) ?? [];
      arr.push(t);
      groups.set(t.netting_group, arr);
    } else out.push(t);
  }
  for (const legs of groups.values()) {
    const anchor = legs.reduce((m, t) => (Math.abs(t.amount ?? 0) > Math.abs(m.amount ?? 0) ? t : m));
    out.push({ ...anchor, amount: legs.reduce((s, t) => s + (t.amount ?? 0), 0) });
  }
  return out;
}

export function expandNettingGroupsForDisplay<T extends Nettable>(rows: T[], allRows: T[]): T[] {
  const byGroup = new Map<string, T[]>();
  for (const row of allRows) {
    if (!row.netting_group) continue;
    const group = byGroup.get(row.netting_group) ?? [];
    group.push(row);
    byGroup.set(row.netting_group, group);
  }

  const seenGroups = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const group = row.netting_group;
    if (!group) {
      out.push(row);
    } else if (!seenGroups.has(group)) {
      seenGroups.add(group);
      out.push(...(byGroup.get(group) ?? [row]));
    }
  }
  return out;
}
