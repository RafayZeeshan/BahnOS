import { describe, expect, it } from "vitest"
import { packet } from "@/lib/packet"

describe("packet index (ADR-015)", () => {
  const p = packet()

  it("loads the 100 orders", () => {
    expect(p.all("orders")).toHaveLength(100)
  })

  it("finds an order by reference", () => {
    expect(p.orderByRef("CD-420299")?.id).toBe("ord-00299")
    expect(p.orderByRef("CD-999999")).toBeUndefined()
  })

  it("collects an order's records per collection", () => {
    const options = p.forOrder("ord-00299", "travel_options")
    expect(options.map((o) => o.status).sort()).toEqual(["AVAILABLE_QUOTE", "SOLD_OUT"])
    expect(p.forOrder("ord-00299", "alerts")[0].signal).toBe("FERRY_SOLD_OUT")
  })

  it("includes bundle offers through order_ids", () => {
    const bundle = p.all("market_offers").find((o) => o.type === "BUNDLE")
    const other = (bundle?.order_ids as string[]).find((id) => id !== bundle?.order_id)!
    expect(p.forOrder(other, "market_offers").some((o) => o.id === bundle?.id)).toBe(true)
  })

  it("looks records up by id", () => {
    expect(p.byId("drivers", "drv-140")?.id).toBe("drv-140")
  })

  it("is cached", () => {
    expect(packet()).toBe(p)
  })
})
