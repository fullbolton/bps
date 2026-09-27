type CapacityRow = { current_count: number; target_count: number };

/** A surplus in one location cannot fill a shortage in another location. */
export function workforceCapacity(row: CapacityRow) {
  return {
    shortage: Math.max(0, row.target_count - row.current_count),
    surplus: Math.max(0, row.current_count - row.target_count),
  };
}
export function workforceCapacityTotals(rows: CapacityRow[]) {
  return rows.reduce((total, row) => {
    const capacity = workforceCapacity(row);
    return { active: total.active + row.current_count, target: total.target + row.target_count,
      shortage: total.shortage + capacity.shortage, surplus: total.surplus + capacity.surplus };
  }, { active: 0, target: 0, shortage: 0, surplus: 0 });
}
