import { describe, expect, it } from "vitest"
import { runTool } from "@/lib/agent/tools"

type Any = Record<string, any>
const run = (tool: string, input: Any) => runTool(tool, input) as Any

describe("get_case", () => {
  const c = run("get_case", { order: "CD-420299" })

  it("names the order, car, customer and driver in plain words", () => {
    expect(c.order).toBe("CD-420299")
    expect(c.car).toMatch(/\w+ \w+/)
    expect(c.customer).toBe("Kavellora Car House")
    expect(c.driver).toBeTruthy()
  })

  it("keeps a sold-out crossing and a quote apart from a booking", () => {
    const labels = c.travel.map((t: Any) => t.evidence.label)
    expect(labels).toContain("provider said sold out")
    expect(labels).toContain("quoted by provider, not booked")
    expect(c.bookings).toEqual([])
  })

  it("surfaces the timed-out booking attempt as an unknown outcome", () => {
    expect(c.earlier_agent_actions).toContainEqual(
      expect.objectContaining({ action: "travel.book_ferry", evidence: expect.objectContaining({ label: "booking outcome unknown" }) }),
    )
  })

  it("attributes every message to who said it, with a time", () => {
    const driver = c.messages.find((m: Any) => m.evidence.label === "driver said")
    expect(driver.at).toBe("2026-10-21T07:20:00Z")
    expect(driver.text).toMatch(/ferry reference/)
  })

  it("shows the alert as a reason to look, with its windows", () => {
    expect(c.alerts[0].evidence.label).toBe("system alert")
    expect(c.windows.map((w: Any) => w.purpose)).toContain("CUSTOMER_DELIVERY_PROMISE")
  })

  it("returns an error for an unknown order", () => {
    expect(run("get_case", { order: "CD-999999" })).toEqual({ error: "No order CD-999999 in the packet." })
  })
})

describe("check_provider_status (mock provider desk)", () => {
  it("reports no reservation held after the timed-out attempt on CD-420299", () => {
    const r = run("check_provider_status", { order: "CD-420299", provider: "Vela Coast Lines" })
    expect(r.holds_reservation).toBe(false)
    expect(r.reference).toBeNull()
    expect(r.evidence).toEqual(expect.objectContaining({ strength: "observed", label: "provider desk replied (mock)" }))
  })

  it("reports a held booking where the packet has one (CD-420603)", () => {
    const r = run("check_provider_status", { order: "CD-420603", provider: "any" })
    expect(r.holds_reservation).toBe(true)
  })
})

describe("price_alternatives", () => {
  it("prices the quoted later sailing with an overnight stop against the delivery promise", () => {
    const r = run("price_alternatives", { order: "CD-420299", reason: "overnight crossing sold out" })
    const later = r.options.find((o: Any) => o.departure_at === "2026-10-24T12:00:00Z")
    expect(later.status).toBe("quote, not booked")
    expect(later.ferry_cents).toBe(38700)
    expect(later.total_cents).toBeGreaterThan(38700)
    expect(later.arrives_by).toBe("2026-10-25T16:00:00Z")
    expect(later.makes_delivery_promise).toBe(true)
    expect(r.options.some((o: Any) => o.departure_at === "2026-10-23T22:00:00Z")).toBe(false)
  })
})

describe("message_driver (recorded replies)", () => {
  it("returns the recorded driver reply as something the driver said", () => {
    const r = run("message_driver", { order: "CD-420299", recipient_role: "driver", question: "Can you take the later sailing?" })
    expect(r.reply.evidence.label).toBe("driver said")
    expect(r.reply.text.length).toBeGreaterThan(10)
  })

  it("says plainly when no reply is recorded", () => {
    const r = run("message_driver", { order: "CD-420001", recipient_role: "driver", question: "?" })
    expect(r.reply).toBeNull()
    expect(r.note).toBe("Message sent. No reply recorded yet.")
  })
})

describe("reference lookups", () => {
  it("returns a planning road range, labelled as an estimate", () => {
    const r = run("get_road_estimate", { from_city: "Berlin", terminal: "West Baltic" })
    expect(r.drive_minutes_low).toBe(180)
    expect(r.note).toMatch(/planning/i)
  })

  it("lists ferry terminals", () => {
    expect(run("get_ferry_terminals", {}).terminals.length).toBe(4)
  })

  it("looks up the answer book in the order's driver's market", () => {
    const out = run("answer_book", { question: "How do I get red plates?", order: "CD-420322" })
    expect(out.market).toBe("DE")
    expect(out.entries.map((e: { id: string }) => e.id)).toContain("doc-red-plates-de")
  })
})

