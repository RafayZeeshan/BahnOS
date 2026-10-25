// Route types and the Google Maps link, safe to use in the browser (route.ts reads files and stays on the server).

export type Stop = { name: string; lat: number; lon: number; timezone: string; kind: "city" | "terminal"; synthetic: boolean; approximate?: boolean; radiusKm?: number }
export type Leg = {
  mode: "drive" | "ferry" | "train" | "flight"
  from: Stop
  to: Stop
  departAt: string | null
  arriveAt: string | null
  minutes: number | null
  basis: "booked" | "quote" | "timetable" | "estimate"
  status: "booked" | "quoted" | "sold_out" | "estimated"
  priceCents: number | null
  synthetic: boolean
}
export type Route = {
  order: string
  legs: Leg[]
  alternatives: { label: string; status: "sold_out"; departAt: string }[]
  arrival: { earliest: string; latest: string; basis: string } | null
  driverEta: { at: string; receivedAt: string } | null
  note: string
}

export function googleMapsLink(leg: Leg): string {
  const c = (s: Stop) => `${Math.round(s.lat * 1000) / 1000},${Math.round(s.lon * 1000) / 1000}`
  return `https://www.google.com/maps/dir/?api=1&origin=${c(leg.from)}&destination=${c(leg.to)}&travelmode=driving`
}
