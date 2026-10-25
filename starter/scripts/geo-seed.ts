// Builds the geo layer for the map (ADR-012): data/geo/stops.json. City coordinates are approximate public
// city centres. The packet's ferry terminals are fictional and held at city level, so each is placed near its
// port city as an approximate area and marked synthetic. Run: npm run geo:seed
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const CITIES: Record<string, [number, number, string]> = {
  Aalborg: [57.048, 9.919, "DK"], Aarhus: [56.157, 10.211, "DK"], Antwerp: [51.219, 4.402, "BE"], Berlin: [52.52, 13.405, "DE"],
  Bordeaux: [44.838, -0.579, "FR"], Cologne: [50.938, 6.96, "DE"], Copenhagen: [55.676, 12.568, "DK"], "Düsseldorf": [51.227, 6.773, "DE"],
  Espoo: [60.205, 24.652, "FI"], Frankfurt: [50.11, 8.682, "DE"], Gothenburg: [57.709, 11.974, "SE"], Graz: [47.071, 15.439, "AT"],
  Hamburg: [53.551, 9.993, "DE"], Helsinki: [60.17, 24.938, "FI"], Lahti: [60.983, 25.656, "FI"], Leipzig: [51.34, 12.375, "DE"],
  Lille: [50.629, 3.057, "FR"], "Linköping": [58.411, 15.622, "SE"], Lyon: [45.764, 4.836, "FR"], "Malmö": [55.605, 13.004, "SE"],
  Marseille: [43.296, 5.37, "FR"], Munich: [48.137, 11.576, "DE"], Odense: [55.396, 10.388, "DK"], Oulu: [65.012, 25.465, "FI"],
  Paris: [48.857, 2.352, "FR"], Pori: [61.485, 21.797, "FI"], Rotterdam: [51.924, 4.478, "NL"], "Seinäjoki": [62.79, 22.84, "FI"],
  Stockholm: [59.329, 18.069, "SE"], Stuttgart: [48.776, 9.183, "DE"], Tampere: [61.498, 23.761, "FI"], Turku: [60.452, 22.267, "FI"],
  Uppsala: [59.859, 17.639, "SE"], Vantaa: [60.294, 25.04, "FI"], Vienna: [48.208, 16.374, "AT"], "Jyväskylä": [62.242, 25.747, "FI"],
}

// Fictional terminals: an approximate area offset towards the water from the port city.
const TERMINALS: Record<string, { near: string; offset: [number, number]; names: string[] }> = {
  "terminal-west-baltic": { near: "Hamburg", offset: [0.03, -0.06], names: ["West Baltic Vehicle Terminal", "West Baltic terminal"] },
  "terminal-south-baltic": { near: "Copenhagen", offset: [0.02, 0.05], names: ["South Baltic Vehicle Terminal", "South Baltic terminal"] },
  "terminal-east-nordic": { near: "Stockholm", offset: [-0.02, 0.08], names: ["East Nordic Vehicle Terminal", "East Nordic terminal", "East Sweden terminal"] },
  "terminal-south-finland": { near: "Helsinki", offset: [-0.02, -0.02], names: ["South Finland Vehicle Terminal", "South Finland terminal"] },
}

const ZONES: Record<string, string> = {
  DE: "Europe/Berlin", FI: "Europe/Helsinki", DK: "Europe/Copenhagen", SE: "Europe/Stockholm", FR: "Europe/Paris",
  NL: "Europe/Amsterdam", BE: "Europe/Brussels", AT: "Europe/Vienna",
}

const stops: Record<string, unknown> = {}
for (const [name, [lat, lon, country]] of Object.entries(CITIES)) {
  stops[name] = { name, lat, lon, country, timezone: ZONES[country], kind: "city", synthetic: false, basis: "approximate city centre" }
}
for (const [id, t] of Object.entries(TERMINALS)) {
  const [lat, lon] = CITIES[t.near]
  const stop = { id, name: t.names[0], lat: Math.round((lat + t.offset[0]) * 1000) / 1000, lon: Math.round((lon + t.offset[1]) * 1000) / 1000, kind: "terminal", near: t.near, timezone: ZONES[CITIES[t.near][2]],
    synthetic: true, approximate: true, radiusKm: 6, basis: "fictional terminal placed near its port city" }
  for (const n of t.names) stops[n] = stop
}

const dir = join(process.cwd(), "..", "data", "geo")
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, "stops.json"), JSON.stringify({ note: "Indicative routes. Terminals are fictional and approximate.", stops }, null, 2) + "\n")
console.log(`Wrote ${Object.keys(stops).length} stops to data/geo/stops.json`)
