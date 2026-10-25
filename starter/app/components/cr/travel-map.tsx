"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState } from "react"
import { googleMapsLink, type Route } from "@/lib/geo/types"
import { legShape, legStyle } from "@/lib/geo/shapes"

// Leaflet on OpenStreetMap tiles, no key (ADR-012). If tiles fail to load, the map steps aside and the
// route strip stands alone. There is no live driver dot: the data has no position.
export function TravelMap({ route, height = 260 }: { route: Route; height?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!box.current) return
    let map: import("leaflet").Map | undefined
    let cancelled = false
    void import("leaflet").then((L) => {
      if (cancelled || !box.current) return
      map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false })
      let tileErrors = 0
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 12, attribution: "© OpenStreetMap contributors" })
        .on("tileerror", () => { tileErrors += 1; if (tileErrors > 3) setFailed(true) })
        .addTo(map)
      const bounds: [number, number][] = []
      for (const leg of route.legs) {
        const shape = legShape(leg)
        bounds.push(...shape)
        L.polyline(shape, { ...legStyle(leg), opacity: 0.9 }).addTo(map)
      }
      const stops = [route.legs[0].from, ...route.legs.map((l) => l.to)]
      for (const s of stops) {
        if (s.approximate) L.circle([s.lat, s.lon], { radius: (s.radiusKm ?? 5) * 1000, color: "#8d8d85", weight: 1, fillOpacity: 0.12 }).bindTooltip(`${s.name} (approximate area)`).addTo(map)
        else L.circleMarker([s.lat, s.lon], { radius: 5, color: "#ff6a3d", weight: 2, fillColor: "#ffffff", fillOpacity: 1 }).bindTooltip(s.name).addTo(map)
      }
      map.fitBounds(bounds, { padding: [24, 24] })
    })
    return () => { cancelled = true; map?.remove() }
  }, [route])

  if (failed) return null
  return <figure className="map" style={{ margin: "16px 0 0" }}>
    <div ref={box} className="map-box" style={{ height }} role="img" aria-label={`Map of the route from ${route.legs[0].from.name} to ${route.legs.at(-1)!.to.name}. The same legs are listed beside it.`} />
    <figcaption className="map-links">
      {route.legs.filter((l) => l.mode === "drive").map((l, i) => <a key={i} className="link" href={googleMapsLink(l)} target="_blank" rel="noreferrer">{l.from.name} → {l.to.name} in Google Maps</a>)}
    </figcaption>
  </figure>
}
