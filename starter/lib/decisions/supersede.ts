// When BahnBot proposes the same kind of action again on an order (a new run, or another Ask BahnBot),
// only the newest run's open proposals of that kind stay; older runs' ones become SUPERSEDED, naming
// the proposal that replaced them, so they re-open if that run is deleted. Decisions a person already
// made are never touched.
const OPEN = new Set(["PROPOSED", "SNOOZED"])

type Row = { id: string; runId: string | null; orderRef: string; action: string; status: string; createdAt: Date }

const newer = (a: Row, b: Row) => a.createdAt.getTime() > b.createdAt.getTime() || (a.createdAt.getTime() === b.createdAt.getTime() && a.id > b.id)

/** The open proposals to retire, each with the id of the newer proposal that replaces it. */
export function staleProposals(rows: Row[]): { id: string; by: string }[] {
  const open = rows.filter((r) => OPEN.has(r.status))
  const newest = new Map<string, Row>()
  for (const r of open) {
    const key = `${r.orderRef}|${r.action}`
    const held = newest.get(key)
    if (!held || newer(r, held)) newest.set(key, r)
  }
  return open
    .filter((r) => {
      const keep = newest.get(`${r.orderRef}|${r.action}`)!
      // A proposal with no run counts as a run of its own.
      return r.id !== keep.id && (r.runId === null || r.runId !== keep.runId)
    })
    .map((r) => ({ id: r.id, by: newest.get(`${r.orderRef}|${r.action}`)!.id }))
    .sort((a, b) => a.id.localeCompare(b.id))
}
