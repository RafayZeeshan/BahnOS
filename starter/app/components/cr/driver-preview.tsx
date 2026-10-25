import type { Route } from "@/lib/geo/types"
import { RouteStrip } from "./route-strip"

// What the driver will see in the app after a person goes ahead, so "who gets told" is concrete. Nothing is sent from here.
export function DriverPreview({ route }: { route: Route }) {
  return <aside className="phone" aria-label="Preview of what the driver will see">
    <div className="phone-screen">
      <div className="phone-notch" />
      <p className="phone-title">Your updated trip</p>
      <RouteStrip route={route} compact />
    </div>
  </aside>
}
