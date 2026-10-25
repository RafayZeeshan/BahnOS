// The ops map (ADR-017): the whole network on one screen, ported from the team's BahnOS.
// Lanes are coloured by BahnOS's own queue; a lane opens its case. Today stays the home screen.
import { AppFrame } from "../components/app-frame"
import { loadOpsMap } from "@/lib/opsmap/load"
import { loadWatch } from "@/lib/opsmap/watch"
import Console from "./console"
import "./map.css"

export const dynamic = "force-dynamic"
export const metadata = { title: "Ops map" }

export default async function OpsMapPage() {
  const { model, bot } = await loadOpsMap()
  return <AppFrame section="map" snapshotAt={new Date(model.snapshot).toISOString()}>
    <main className="pg" style={{ maxWidth: 1560 }}>
      <Console model={model} watch={loadWatch()} bot={bot} />
    </main>
  </AppFrame>
}
