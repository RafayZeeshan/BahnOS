// Pickup and delivery city for every order, by reference: enough to draw a lane on a map.
import { load, loadRoute } from './data'

export type Places = Record<string, { from: string; to: string }>

export function orderPlaces(): Places {
  const addr = new Map(loadRoute().addresses.map((a) => [a.id, a]))
  const out: Places = {}
  for (const o of load().orders) {
    out[o.reference] = { from: addr.get(o.pickup_address_id)?.city ?? '?', to: addr.get(o.delivery_address_id)?.city ?? '?' }
  }
  return out
}
