import type { ActionDef, JsonSchema, Recipient, Response } from "./types"

export type { ActionDef, ActionKind, BlockerFacts, Recipient, Response } from "./types"

const ORDER = { type: "string", description: "Order reference, for example CD-420299." }

function schema(properties: JsonSchema["properties"], required: string[]): JsonSchema {
  return { type: "object", properties, required }
}

const role = (recipients: Recipient[], description: string) => ({ type: "string", description, enum: recipients })
const DRIVER_ROLE = role(["driver"], "Always \"driver\": the order's assigned driver.")
const SITE_ROLE = role(["pickup_site", "travel_provider"], "\"pickup_site\" for the site the car is collected from, or \"travel_provider\" for a ferry or travel desk. Never a delivery site or a customer.")

function effects(goAhead: string): Record<Response, string> {
  return {
    go_ahead: goAhead,
    change_it: "Your changed version goes ahead instead, and BahnBot learns from the change.",
    take_over: "You handle it yourself. BahnBot stops and keeps the history.",
    not_this: "Nothing changes. Your reason is kept so BahnBot can learn from it.",
  }
}

const defs: ActionDef[] = [
  {
    name: "get_case",
    kind: "read",
    description: "Read an order: route, car, windows, driver work, travel, messages, alerts and open work, with sources and times.",
    input_schema: schema({ order: ORDER }, ["order"]),
    approver: null,
  },
  {
    name: "get_travel_options",
    kind: "read",
    description: "List recorded ferry, train, flight and hotel options for an order, each with its status and when it was checked.",
    input_schema: schema({ order: ORDER }, ["order"]),
    approver: null,
  },
  {
    name: "answer_book",
    kind: "read",
    description: "Look up Bahn's driver-support answer book: policy for drivers (expenses, plates, pickup, on the road, pay, insurance). Each entry has a routing you must follow: ANSWER (you may answer), LOOKUP (state only what the records establish), ASK (ask the driver one question first), ESCALATE (a person decides). Pass the order so the driver's market is applied.",
    input_schema: schema({
      question: { type: "string", description: "The driver's question, in their own words." },
      order: { ...ORDER, description: "The order the question is about. The driver's market is taken from it." },
      market: { type: "string", enum: ["FI", "DE", "DK"], description: "The driver's market, only when there is no order." },
    }, ["question"]),
    approver: null,
  },
  {
    name: "get_ferry_terminals",
    kind: "read",
    description: "List ferry terminals with their city and planning notes.",
    input_schema: schema({}, []),
    approver: null,
  },
  {
    name: "get_road_estimate",
    kind: "read",
    description: "Planning road time from a city to a ferry terminal. An estimate, not a live position.",
    input_schema: schema(
      { from_city: { type: "string", description: "Start city." }, terminal: { type: "string", description: "Terminal name." } },
      ["from_city", "terminal"],
    ),
    approver: null,
  },
  {
    name: "check_provider_status",
    kind: "read",
    description:
      "Ask a travel provider what it actually holds for an order: any reservation, its reference and vehicle space. Use this before rebooking after a timed-out or failed attempt.",
    input_schema: schema({ order: ORDER, provider: { type: "string", description: "Provider name, for example Vela Coast Lines." } }, ["order", "provider"]),
    approver: null,
  },
  {
    name: "message_driver",
    kind: "ask",
    description: "Send the assigned driver a question in the driver app. No approval needed. Never promise dates, costs or bookings.",
    input_schema: schema(
      { order: ORDER, recipient_role: DRIVER_ROLE, question: { type: "string", description: "One clear question." } },
      ["order", "recipient_role", "question"],
    ),
    approver: null,
    recipients: ["driver"],
  },
  {
    name: "call_site",
    kind: "ask",
    description: "Call the pickup site, or a travel provider's desk, to ask a question. The call opens by saying it is an AI. Never call a delivery site or a customer.",
    input_schema: schema(
      { order: ORDER, recipient_role: SITE_ROLE, questions: { type: "array", description: "Questions to ask, one at a time.", items: { type: "string" } } },
      ["order", "recipient_role", "questions"],
    ),
    approver: null,
    recipients: ["pickup_site", "travel_provider"],
  },
  {
    name: "call_driver",
    kind: "ask",
    description: "Call the assigned driver to ask a question, for example whether they are safe and where exactly they are.",
    input_schema: schema(
      { order: ORDER, recipient_role: DRIVER_ROLE, questions: { type: "array", description: "Questions to ask, one at a time.", items: { type: "string" } } },
      ["order", "recipient_role", "questions"],
    ),
    approver: null,
    recipients: ["driver"],
  },
  {
    name: "price_alternatives",
    kind: "plan",
    description: "Price and time alternative travel plans for the driver (later sailing, hotel, train, flight, last stretch). Mock prices.",
    input_schema: schema({ order: ORDER, reason: { type: "string", description: "Why alternatives are needed." } }, ["order", "reason"]),
    approver: null,
  },
  {
    name: "raise_heads_up",
    kind: "flag",
    description: "Flag an order that looks at risk before anything has gone wrong. A flag, not an action.",
    input_schema: schema(
      {
        order: ORDER,
        risk: { type: "string", description: "Watch or likely to slip.", enum: ["watch", "likely_to_slip"] },
        line: { type: "string", description: "One plain sentence for ops." },
      },
      ["order", "risk", "line"],
    ),
    approver: null,
  },
  {
    name: "propose_booking",
    kind: "propose",
    description: "Propose booking a travel option for the driver. A person decides; nothing is bought.",
    input_schema: schema(
      { order: ORDER, option_id: { type: "string", description: "The travel option to book." }, why: { type: "string", description: "Why this option." } },
      ["order", "option_id"],
    ),
    approver: "person",
    effects: effects("The booking is made with the provider, the driver is told the new plan, and the next step opens."),
    blockers: (_input, facts) => [
      ...(facts.optionOnOrder === false ? ["That travel option is not on this order."] : []),
      ...(facts.optionStatus === "SOLD_OUT" ? ["The selected crossing is sold out."] : []),
      ...(facts.unresolvedAttempt ? ["An earlier booking attempt has an unknown outcome."] : []),
    ],
  },
  {
    name: "propose_hotel",
    kind: "propose",
    description: "Propose a hotel night for the driver. A person decides.",
    input_schema: schema(
      { order: ORDER, city: { type: "string", description: "City." }, night_of: { type: "string", description: "Date of the night." } },
      ["order", "city", "night_of"],
    ),
    approver: "person",
    effects: effects("The hotel is booked and the driver gets the address."),
    blockers: () => [],
  },
  {
    name: "propose_date_change",
    kind: "propose",
    description: "Propose a new delivery date. A person decides, and the customer must agree before it is promised.",
    input_schema: schema(
      { order: ORDER, new_date: { type: "string", description: "Proposed delivery date." }, why: { type: "string", description: "Reason." } },
      ["order", "new_date"],
    ),
    approver: "person",
    effects: effects("The new date is recorded as proposed and a customer update is drafted for a person to send."),
    blockers: () => [],
  },
  {
    name: "propose_cost",
    kind: "propose",
    description: "Propose an extra cost (ferry difference, hotel, taxi). A person decides.",
    input_schema: schema(
      {
        order: ORDER,
        amount_cents: { type: "number", description: "Amount in cents." },
        currency: { type: "string", description: "Currency code." },
        why: { type: "string", description: "What the cost is for." },
      },
      ["order", "amount_cents", "currency", "why"],
    ),
    approver: "person",
    effects: effects("The cost is approved for this order and recorded."),
    blockers: () => [],
  },
  {
    name: "draft_customer_update",
    kind: "propose",
    description: "Draft a message to the customer. BahnBot never sends it; a person reviews and sends.",
    input_schema: schema({ order: ORDER, body: { type: "string", description: "The draft message." } }, ["body"]),
    approver: "person",
    effects: effects("A person sends this message to the customer."),
    blockers: () => [],
  },
  {
    name: "escalate",
    kind: "stop",
    description: "Stop and hand the case to a person with what you know and what you do not know.",
    input_schema: schema(
      {
        order: ORDER,
        reason: { type: "string", description: "Why a person is needed." },
        what_i_know: { type: "array", description: "Facts, each with its source.", items: { type: "string" } },
        what_i_dont_know: { type: "array", description: "Open questions.", items: { type: "string" } },
      },
      ["order", "reason", "what_i_know", "what_i_dont_know"],
    ),
    approver: null,
  },
]

export const ACTIONS: Record<string, ActionDef> = Object.fromEntries(defs.map((d) => [d.name, d]))

export function actionFor(name: string): ActionDef | undefined {
  return ACTIONS[name]
}

/** Missing required fields, in plain words. */
export function validate(action: ActionDef, input: Record<string, unknown>): string[] {
  return action.input_schema.required
    .filter((key) => input[key] === undefined || input[key] === null || input[key] === "")
    .map((key) => `Missing ${key}.`)
}
