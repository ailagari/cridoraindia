/**
 * Centralized cross-redemption / vault-liquidity legal copy (UI strings only).
 * Wording is informational — not jurisdiction-specific advice.
 */

/** Single-line master disclaimer (e.g. global footer). */
export const crossRedemptionMasterDisclaimer =
  'Cridora provides software to coordinate jeweller-agnostic vault movements; settlement and storefront fulfilment remain between you and participating jewellers. Nothing here is legal, tax, or investment advice.'

/** Short lines for expandable transactional strip (max ~4 visible when expanded). */
export const crossRedemptionTransactionalLines: readonly string[] = [
  'Cross-redemption routes vault grams between jewellers you choose, subject to each jeweller’s policies and any exposure limits.',
  'Authorisation does not move metal; fulfilment runs only after required approvals and a committed step sequence.',
  'Displayed statuses (Instant / Fast / Processing / Completed / Failed) describe customer experience only, not regulatory labels.',
  'Read your jeweller’s terms and keep records of counter visits, settlements, and tax reporting where applicable.',
]
