/** Missing names must not silently remove records from a report. Compare IDs, not display text. */
export function hasCompleteCompanyReferences(rows: readonly {company_id: string}[] | null, companyIds: ReadonlySet<string> | null): boolean {
  return rows !== null && companyIds !== null && rows.every(row => companyIds.has(row.company_id));
}
