// Geometry and line style for the map (ADR-012). Booked is solid, quoted dashed, estimated dotted.
import type { Leg } from "./types"

export type LatLon = [number, number]

export function legShape(leg: Leg): LatLon[] {
  const a: LatLon = [leg.from.lat, leg.from.lon]
  const b: LatLon = [leg.to.lat, leg.to.lon]
  if (leg.mode !== "ferry") return [a, b]
  // A sea arc: a quadratic curve with its control point pushed off the straight line, so it reads as a crossing.
  const mid: LatLon = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const dx = b[1] - a[1]
  const dy = b[0] - a[0]
  const control: LatLon = [mid[0] - dx * 0.18, mid[1] + dy * 0.18]
  const points: LatLon[] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    points.push([
      (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * control[0] + t ** 2 * b[0],
      (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * control[1] + t ** 2 * b[1],
    ])
  }
  return points
}

export function legStyle(leg: Leg): { color: string; weight: number; dashArray?: string } {
  if (leg.status === "booked") return { color: "#1b7a52", weight: 4 }
  if (leg.status === "quoted") return { color: "#1f6f7b", weight: 4, dashArray: "8 6" }
  if (leg.status === "sold_out") return { color: "#b42c42", weight: 3, dashArray: "1 8" }
  return { color: "#726958", weight: 3, dashArray: "2 6" }
}
