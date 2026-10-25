import { describe, expect, it } from "vitest"
import { plainReason, shortHeadline } from "@/lib/control/wording"

describe("plain words for system text", () => {
  it("drops record-type prefixes", () => {
    expect(plainReason("Open alert: Ferry sold out.").text).toBe("Ferry sold out.")
    expect(plainReason("Incident: Travel capacity. Awaiting decision.").text).toBe("Travel capacity. Awaiting decision.")
    expect(plainReason("Owned alert: Ferry sold out").text).toBe("Ferry sold out")
  })

  it("turns 'source is a conversation' into a not-confirmed tag", () => {
    const r = plainReason("Open alert: Ferry connection risk. Review ferry cutoff for CD-420603; source is a conversation, not a verified outcome.")
    expect(r.text).toBe("Ferry connection risk. Review ferry cutoff.")
    expect(r.notConfirmed).toBe(true)
  })

  it("leaves plain text alone", () => {
    expect(plainReason("Driver reports a red warning.")).toEqual({ text: "Driver reports a red warning.", notConfirmed: false })
  })

  it("keeps a headline to its first sentence, and cuts an overlong one at a word", () => {
    expect(shortHeadline("Book travel: Overnight sailing 23 Oct is sold out. The provider confirmed at 09:00Z. It costs EUR 387.00. The desk says vehicle space is open on the later sailing but it is not held, and the driver needs a hotel night."))
      .toBe("Book travel: Overnight sailing 23 Oct is sold out.")
    expect(shortHeadline("Ferry sold out. Nothing is booked.")).toBe("Ferry sold out. Nothing is booked.")
    const long = shortHeadline(`The owner has to decide ${"how the car is handled ".repeat(10)}now.`)
    expect(long.length).toBeLessThanOrEqual(140)
    expect(long.endsWith("…")).toBe(true)
    expect(long).not.toMatch(/\s…$/)
  })
})
