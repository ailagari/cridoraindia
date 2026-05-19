# Cridora India — Feature Status Report

**Legend:**  
- **FULLY IMPLEMENTED** — End-to-end UI + API + persistence  
- **PARTIALLY IMPLEMENTED** — Some layers missing or manual/stub steps  
- **UI ONLY** — Frontend without backend  
- **BACKEND ONLY** — API/models without user-facing UI  
- **PLACEHOLDER / DISABLED** — Explicit Coming Soon or demo-only  
- **NOT IN CODEBASE** — Not found in repository  

---

## Summary table

| Feature | Status | Customer | Jeweller | Admin |
|---------|--------|----------|----------|-------|
| Email/password auth | FULLY IMPLEMENTED | ✅ | ✅ | ✅ |
| JWT refresh/logout | FULLY IMPLEMENTED | ✅ | ✅ | ✅ |
| Customer KYC | FULLY IMPLEMENTED | ✅ | — | ✅ |
| Jeweller KYB | FULLY IMPLEMENTED | — | ✅ | ✅ |
| Fractional gold purchase | FULLY IMPLEMENTED | ✅ | ✅ | ⚠️ policy |
| Gold deposit intake | FULLY IMPLEMENTED | ✅ | ✅ | — |
| Gold sellback | FULLY IMPLEMENTED | ✅ | ✅ | — |
| GoldUPI / transfers | FULLY IMPLEMENTED | ✅ | ✅ | — |
| Vault portfolio view | FULLY IMPLEMENTED | ✅ | ✅ | ✅ |
| Personal holdings (off-vault) | PARTIALLY IMPLEMENTED | ✅ | ✅ | ✅ |
| Marketplace catalog | FULLY IMPLEMENTED | ✅ | ✅ | ✅ |
| Marketplace checkout | PARTIALLY IMPLEMENTED | ✅ | — | — |
| Vault ornament redemption API | PARTIALLY IMPLEMENTED | ⚠️ | ✅ | — |
| Cross-redemption saga | PARTIALLY IMPLEMENTED | ✅ | ✅ | ✅ |
| Settlement automation | PLACEHOLDER | — | — | ❌ UI |
| Golden scheme enrollment | PLACEHOLDER | ❌ | ⚠️ disclosure | ❌ |
| Gold loans | PLACEHOLDER | ❌ | — | — |
| CridoraPay card gateway | PLACEHOLDER | demo | — | — |
| SMS phone OTP login | BACKEND ONLY | — | — | — |
| Live rates / ticker | FULLY IMPLEMENTED | public | public | ✅ |
| Web Push | PARTIALLY IMPLEMENTED | ✅ | ✅ | ✅ |
| Native FCM push | PARTIALLY IMPLEMENTED | ✅ | ✅ | — |
| Notifications bell | PARTIALLY IMPLEMENTED | ✅ | ✅ | ✅ |
| Festival broadcast | FULLY IMPLEMENTED | push | push | ✅ |
| Admin freeze user | FULLY IMPLEMENTED | — | — | ✅ |
| Waitlist | UI ONLY | public | — | — |
| Default jeweller picker UI | PARTIALLY IMPLEMENTED | ⚠️ | — | — |

---

## Detailed feature entries

### Authentication & identity

#### Email registration & login — FULLY IMPLEMENTED

- **Description:** Customer and jeweller accounts with email/password; JWT session.
- **Routes:** `/login`, `/signup`, `/jeweller/apply`
- **APIs:** `/auth/login/`, `/auth/register/`, `/auth/jeweller/apply/`, `/auth/me/`, `/auth/token/refresh/`, `/auth/logout/`
- **DB:** `User`
- **Gaps:** No email verification, no password reset.

#### Phone SMS OTP — BACKEND ONLY (scaffold)

- **Description:** `PhoneOTPChallenge` model for future SMS login.
- **APIs:** None
- **Status:** Model + `phone_utils.py` only.

#### Cridora member ID & GoldUPI — FULLY IMPLEMENTED

- **Description:** `CRI{pk}` member id; `gold_upi`, `gold_routing_code`, handles.
- **APIs:** `/gold/identity/`, `/gold/resolve/`, `/gold/pay/<upi>/`
- **DB:** `User` fields, `GoldVault`

---

### Gold vault & holdings

#### Custodial vault — FULLY IMPLEMENTED

- **Description:** Per customer–jeweller vault with holding types: fractional, deposit, golden_scheme (type exists; scheme flow not built).
- **APIs:** `/gold/wallet/`
- **DB:** `GoldVault`, `VaultHolding`, `GoldBalance`

#### Fractional purchase — FULLY IMPLEMENTED

- **Description:** Quote, order, counter OTP or UPI+UTR, jeweller verify, vault credit.
- **Routes:** `invest_fractional`
- **APIs:** `/fractional/*`, `/jeweller/fractional/*`
- **DB:** `FractionalGoldPurchase`, `FractionalCounterOtp`, `JewellerLiabilityLedgerEntry`

#### Gold deposit — FULLY IMPLEMENTED

- **Routes:** customer `invest_deposit`; jeweller `txn_deposits`
- **APIs:** `/gold-deposit/*`, `/jeweller/gold-deposit/*`
- **DB:** `GoldDepositIntake`, `GoldDepositCounterOtp`

#### Sellback — FULLY IMPLEMENTED

- **Routes:** `redeem_cash`
- **APIs:** `/gold/sellback/*`, `/jeweller/sellbacks/*`
- **DB:** `GoldSellbackRequest`, `GoldSellbackOtp`

#### P2P transfer — FULLY IMPLEMENTED

- **Routes:** `redeem_transfer`
- **APIs:** `/gold/transfers/`
- **DB:** `GoldTransfer`

#### Personal holdings vault — PARTIALLY IMPLEMENTED

- **Description:** Track off-platform gold with documents; estimated value from 22K reference; **explicitly not redeemable/transferable**.
- **APIs:** `/portfolio/personal-holdings/*`
- **DB:** `PersonalGoldHolding`, `PersonalHoldingDocument`, `PersonalPortfolioAuditLog`
- **Gap:** No link to custodial vault redemption.

---

### Marketplace & redemption

#### Public marketplace — FULLY IMPLEMENTED

- **Routes:** `/marketplace`, `/shop`, jeweller pages
- **APIs:** `/marketplace/jewellers/`, `/products/`, `catalog-meta`, `spot-prices`, `gold-ticker`
- **DB:** `MarketplaceProduct`, `JewellerPricingProfile`, `MetalPurity`, `ProductCategory`

#### Jeweller catalog management — FULLY IMPLEMENTED

- **Routes:** `mkt_products`, `mkt_policy`
- **APIs:** `/jeweller/marketplace/*`
- **Gate:** KYB verified for product writes.

#### Admin product moderation — FULLY IMPLEMENTED

- **APIs:** `/admin/marketplace/products/`, `moderate/`

#### Marketplace checkout — PARTIALLY IMPLEMENTED

- **Description:** Cart + checkout for real SKUs; UPI at counter demo; card is **demo only**.
- **UI:** `MarketplaceCheckoutFlow` — `card_demo` placeholder
- **Gap:** No payment gateway webhooks; vault debit path separate from card demo.

#### Vault ornament redemption — PARTIALLY IMPLEMENTED

- **Backend:** `VaultProductRedemption`, `/marketplace/redemption/quote|confirm/`
- **UI:** Jeweller list in ops; **customer shop panel not routed**
- **Gap:** Wire `CustomerVaultRedemptionShopPanel` or remove.

#### Demo catalog merge — PLACEHOLDER (production risk)

- **Files:** `jewellerMarketplaceDemos.ts`, `productMarketplaceDemos.ts`
- **Behavior:** Injects fake jewellers/products (negative IDs); checkout blocked for demos.

---

### Cross-redemption & settlement

#### Cross-redemption saga — PARTIALLY IMPLEMENTED

- **Description:** Multi-step jeweller + customer authorization, exposure limits, saga recovery.
- **APIs:** `/cross-redemption/*`, `/jeweller/cross-redemption/*`, `/admin/cross-redemption/*`
- **DB:** `CrossRedemptionRequest`, saga-related tables
- **Gaps:** Outbox stub; manual settlement; no bank integration.

#### Settlement batches — BACKEND ONLY + PLACEHOLDER UI

- **DB:** `SettlementBatch`, `SettlementObligation`
- **Command:** `cross_redemption_run_settlement_mvp`
- **UI:** Admin `fin_hub` — **Coming Soon**

---

### Schemes, loans, treasury

#### Golden scheme — PLACEHOLDER (customer) / PARTIAL (jeweller disclosure)

- **DB:** `JewellerPricingProfile` golden_scheme_* fields; `VaultHolding.GOLDEN_SCHEME` type
- **UI:** Customer `invest_scheme` Coming Soon; jeweller can enable disclosure text
- **Gap:** No enrollment, payments, or ledger for scheme.

#### Gold loans — PLACEHOLDER

- **UI:** `redeem_loan` Coming Soon
- **DB:** `GoldTickerConfig` has loan APR / processing fee fields — **no loan models or APIs**

#### Admin treasury / settlements UI — PLACEHOLDER

- **Section:** `fin_hub`, `mkt_programs`

---

### Notifications & push

#### Platform notifications API — FULLY IMPLEMENTED

- **APIs:** `/notifications/`, `/admin/notifications/`, portfolio notifications

#### Web Push — PARTIALLY IMPLEMENTED

- Requires VAPID env vars; subscribe/unsubscribe endpoints.

#### Native FCM — PARTIALLY IMPLEMENTED

- Requires `FIREBASE_SERVICE_ACCOUNT_JSON`; Capacitor bridge on Android.

#### Guest notification bell — UI ONLY (mock)

- **File:** `mockNotifications.ts` — used when not on live feed.

#### Festival broadcast — FULLY IMPLEMENTED

- Admin CRUD + cron `process_festival_broadcasts`

---

### Admin & compliance

#### KYC/KYB review — FULLY IMPLEMENTED

- Approve, reject, revoke, re-upload, freeze

#### Gold ticker admin — FULLY IMPLEMENTED

- Live/manual adjustments, history, cross-platform fee

#### Fractional counter OTP policy — FULLY IMPLEMENTED

- Singleton `PlatformOperationalSettings`

---

## Section 15 — Feature gap analysis (implementation vs intended MVP)

| Intended MVP capability | Current state |
|-------------------------|---------------|
| Verified jeweller network | ✅ KYB + public directory filters verified |
| Buy/sell gold at jeweller | ✅ Fractional + sellback |
| Custody tracking | ✅ Vault + liability ledger |
| Marketplace browse/buy | ⚠️ Checkout without real payments |
| Cross-store emergency redeem | ⚠️ Saga works; settlement manual |
| Golden scheme savings | ❌ Disclosure only |
| Gold loans | ❌ UI placeholder |
| Automated settlement | ❌ MVP stub |
| SMS OTP | ❌ Model only |
| Payment gateway | ❌ Manual UTR |
| Staff accounts | ❌ Not in codebase |

### Dangerous assumptions / fake systems

1. **Demo card checkout** could confuse testers — labeled demo but present in flow.
2. **Demo catalog items** mixed with real API data.
3. **Integration outbox** appears operational but performs no external calls.
4. **Personal holdings** could be mistaken for redeemable gold without reading `mvp_note`.
5. **Guest notifications** look real but are mock.

### Architecture debt

- Monolithic authorization (no permission classes)
- Section-query dashboards (hard to deep-link test)
- No CI/CD
- Large admin page component

---

*See [PENDING_TASKS.md](./PENDING_TASKS.md) for remediation backlog.*
