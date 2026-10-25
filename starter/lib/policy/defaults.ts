// Policy v1: the versioned harness Dream may change (ADR-011). Only a person adopts a new version.

export type Approval = "person" | "auto"

export type Policy = {
  version: number
  approval: Record<string, Approval>
  watch: {
    slack_min_minutes: number
    likely_slip_slack_minutes: number
    quote_max_age_hours: number
    eta_max_age_hours: number
  }
  risk: {
    min_sample: number
    shrinkage_strength: number
    elevated_rate: number
    /** Also flag orders that ride on an elevated source of failure (a root-cause lesson). */
    watch_on_elevated: boolean
  }
  lessons: { text: string; caseRefs: string[]; shared?: string | null }[]
}

export const POLICY_V1: Policy = {
  version: 1,
  approval: {
    propose_booking: "person",
    propose_hotel: "person",
    propose_date_change: "person",
    propose_cost: "person",
    draft_customer_update: "person",
  },
  watch: {
    slack_min_minutes: 180,
    likely_slip_slack_minutes: 60,
    quote_max_age_hours: 24,
    eta_max_age_hours: 3,
  },
  risk: {
    min_sample: 3,
    shrinkage_strength: 4,
    elevated_rate: 0.35,
    watch_on_elevated: false,
  },
  lessons: [],
}
