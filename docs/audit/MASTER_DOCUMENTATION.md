# Cridora India — Master Project Documentation

**Audit date:** 2026-05-19  
**Repository:** `cridoraindia` (`C:\Users\Lagari A\Desktop\IDEAS\git\cridoraindia`)  
**Method:** Full codebase analysis — routes, models, APIs, UI, deploy config. No assumed DPR/planned-only features.

---

## Document index

| Document | Purpose |
|----------|---------|
| [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | Stack, deployment topology, module boundaries |
| [USER_FLOWS.md](./USER_FLOWS.md) | Step-by-step journeys by role |
| [FEATURE_STATUS_REPORT.md](./FEATURE_STATUS_REPORT.md) | Every feature with implementation status |
| [DATABASE_REPORT.md](./DATABASE_REPORT.md) | Tables, relationships, business data model |
| [API_REPORT.md](./API_REPORT.md) | Complete REST endpoint catalog |
| [UI_UX_STRUCTURE.md](./UI_UX_STRUCTURE.md) | Pages, dashboards, design system, responsive/PWA |
| [PENDING_TASKS.md](./PENDING_TASKS.md) | Prioritized backlog from gaps |
| [SECURITY_AND_RISK_REPORT.md](./SECURITY_AND_RISK_REPORT.md) | Auth, authorization, vulnerabilities |
| [DEPLOYMENT_AND_ENV_REPORT.md](./DEPLOYMENT_AND_ENV_REPORT.md) | Env vars, Docker, Railway, cron |
| [PROJECT_SUMMARY.json](./PROJECT_SUMMARY.json) | Machine-readable snapshot |

---

## Section 1 — Project overview

### What Cridora currently is

Cridora India is a **jewellery-linked digital gold platform** for the Indian market. The live implementation centers on:

1. **Custodial gold vaults** — per-customer vaults held at verified jeweller custodians.
2. **Fractional gold purchase** — customers buy grams at jeweller counter or via manual UPI + UTR.
3. **Physical gold deposit** — jeweller records intake; customer confirms via counter OTP.
4. **Sellback (cash redemption)** — customer sells vault grams back to jeweller (cash OTP or UPI payout).
5. **GoldUPI** — P2P gram transfers between customers (`handle@jewellercode`, routing codes).
6. **Marketplace** — jeweller SKU catalog, live/managed gold ticker, ornament redemption from vault.
7. **Cross-redemption** — emergency cross-jeweller redemption saga with exposure limits and manual settlement MVP.
8. **Personal holdings vault** — off-platform gold tracking (documents only; not redeemable in MVP).
9. **KYC/KYB** — document upload + admin approval workflows.

This is **not** a full banking or payment-aggregator product yet. Payments are **manual UPI + UTR confirmation** or **in-person counter OTP** — no Razorpay/Stripe/Cashfree integration in code.

### Current MVP direction (as implemented)

- Single monolithic deploy: Django serves API + static React SPA.
- Three roles: **customer**, **jeweller**, **admin** (no separate “super admin” type; Django `is_superuser` syncs to platform admin).
- Verification gates: many money flows require `kyc_status == verified`.
- Jeweller marketplace is **real API-backed** with optional **demo listings** merged in UI for empty states.
- Nationwide automated settlement is **deferred** — `SettlementBatch` / obligations exist; admin UI shows “Coming soon”.

### Architecture approach

```
Browser / Capacitor WebView
        │  HTTPS (JWT Bearer)
        ▼
┌───────────────────────────────────────┐
│  Gunicorn → Django 5                  │
│  • REST /api/v1/*                     │
│  • WhiteNoise → frontend/dist (SPA)   │
│  • FileSystemStorage → /media (KYC)    │
└───────────────────────────────────────┘
        │
        ▼
   PostgreSQL (Railway)
```

### Technology stack (actual)

| Layer | Technology |
|-------|------------|
| Frontend | React 18.3, Vite 6, TypeScript ~5.6, React Router 6 |
| State | React Context (`AuthContext`, `ThemeContext`) — no Redux/React Query |
| Styling | Custom CSS (`src/styles/index.css`) — no component library |
| Backend | Django 5, DRF, SimpleJWT + token blacklist |
| DB | PostgreSQL via `dj-database-url`; SQLite if no `DATABASE_URL` |
| Auth | Email/password → JWT (access 8h, refresh 14d, rotate + blacklist) |
| Static/media | WhiteNoise + `FileSystemStorage` |
| PWA | `vite-plugin-pwa`, custom Workbox `src/sw.ts` |
| Native | Capacitor 7 Android (`in.cridora.app`) |
| Push | `pywebpush` (VAPID) + `firebase-admin` (FCM) |

### Project maturity (evidence-based)

| Dimension | Assessment |
|-----------|------------|
| Core gold wallet flows | **Operational** — fractional, deposit, sellback, transfer |
| Marketplace | **Operational** — catalog, ticker, jeweller admin, moderation |
| Cross-redemption | **Operational in-app** — saga + manual settlement; no bank rails |
| Golden scheme / loans | **Not implemented** (UI placeholders; scheme fields are disclosure-only on storefront) |
| Payments | **Manual** — UTR workflows; card checkout is demo-only in UI |
| CI/CD | **None** in repository |
| Automated tests | **Limited** — ~11 test modules under `accounts/tests` |

**Overall:** Strong **MVP demo/production pilot** for jeweller–customer gold operations; **not** production-ready for regulated payments at scale without gateway, SMS OTP, rate limits, and settlement automation.

---

## Section 2 — User types & role system

See [USER_FLOWS.md](./USER_FLOWS.md) and [FEATURE_STATUS_REPORT.md](./FEATURE_STATUS_REPORT.md).

| Role | `user_type` | Dashboard route | Platform admin check |
|------|-------------|-----------------|----------------------|
| Public visitor | — | Public pages | — |
| Customer | `customer` | `/userdashboard?section=` | — |
| Jeweller | `jeweller` | `/dashboard/jeweller?section=` | — |
| Admin | `admin` | `/dashboard/admin?section=` | `user_type==admin` OR (`is_superuser` AND `is_staff`) |

**Not implemented:** Staff/subaccounts, jeweller employees, granular Django permissions per endpoint. Authorization is **inline role checks** in views.

**Jeweller preferences (customer):** `default_jeweller`, `jeweller_pref_nearby`, `jeweller_pref_ornament`, `jeweller_pref_redemption` — backend fields exist; UI “set default jeweller” on marketplace grid is **coming soon**.

---

## Section 3 — Authentication system

| Capability | Status |
|------------|--------|
| Customer signup (`POST /auth/register/`) | **IMPLEMENTED** |
| Jeweller apply (`POST /auth/jeweller/apply/`) | **IMPLEMENTED** |
| Login → JWT | **IMPLEMENTED** |
| Refresh + logout blacklist | **IMPLEMENTED** |
| Password change | **IMPLEMENTED** |
| Session cookies for API | **NOT USED** — JWT only |
| SMS/phone OTP login | **MODEL ONLY** (`PhoneOTPChallenge`) — no API |
| Email verification | **NOT IMPLEMENTED** |
| Password reset email | **NOT IMPLEMENTED** |
| KYC upload + admin approve | **IMPLEMENTED** |
| Role assignment | **At registration**; admin via Django superuser sync |

**Frontend:** Tokens in `localStorage`; bootstrap restores cached user without mandatory `/auth/me/` on load. `authFetch` refreshes on 401.

**Onboarding redirects:** `/onboarding/kyc` → customer KYC section; `/onboarding/jeweller-kyb` → jeweller KYB section.

Details: [SECURITY_AND_RISK_REPORT.md](./SECURITY_AND_RISK_REPORT.md).

---

## Sections 4–20 — Pointers

| Section | Document |
|---------|----------|
| 4 Feature inventory | [FEATURE_STATUS_REPORT.md](./FEATURE_STATUS_REPORT.md) |
| 5 User flows | [USER_FLOWS.md](./USER_FLOWS.md) |
| 6 Dashboard structure | [UI_UX_STRUCTURE.md](./UI_UX_STRUCTURE.md) |
| 7 Routes | [UI_UX_STRUCTURE.md](./UI_UX_STRUCTURE.md) § Routes |
| 8 Database | [DATABASE_REPORT.md](./DATABASE_REPORT.md) |
| 9 APIs | [API_REPORT.md](./API_REPORT.md) |
| 10 UI/UX | [UI_UX_STRUCTURE.md](./UI_UX_STRUCTURE.md) |
| 11 Performance/realtime | [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) § Realtime |
| 12 Security | [SECURITY_AND_RISK_REPORT.md](./SECURITY_AND_RISK_REPORT.md) |
| 13 Notifications | [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) § Notifications |
| 14 Mobile/PWA | [UI_UX_STRUCTURE.md](./UI_UX_STRUCTURE.md) § PWA |
| 15 Gap analysis | [FEATURE_STATUS_REPORT.md](./FEATURE_STATUS_REPORT.md) § Gap analysis |
| 16 Pending tasks | [PENDING_TASKS.md](./PENDING_TASKS.md) |
| 17 Code quality | [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) § Code quality |
| 18 Deployment | [DEPLOYMENT_AND_ENV_REPORT.md](./DEPLOYMENT_AND_ENV_REPORT.md) |
| 19 Business logic | [DATABASE_REPORT.md](./DATABASE_REPORT.md) § Business logic |
| 20 System health | Below |

---

## Section 20 — Final system health report

### Readiness scores (code-evidence estimates)

| Metric | % | Rationale |
|--------|---|-----------|
| MVP readiness | **68** | Core gold + marketplace + KYC work end-to-end with manual payments |
| Production readiness | **48** | No payment gateway, limited tests, no CI, stub outbox/settlement |
| UI completion | **74** | Full dashboard shells; 5+ explicit Coming Soon sections |
| Backend completion | **72** | ~120 REST endpoints; gaps in loans/schemes/SMS OTP |
| Security readiness | **52** | JWT solid; missing rate limits, reset flow, some AllowAny endpoints |
| Scalability readiness | **55** | Monolith OK early; saga/outbox patterns started but not production-grade |

### Biggest risks

1. **Financial reconciliation** relies on manual UTR and jeweller honesty — no PSP webhooks.
2. **Cross-redemption settlement** is MVP manual (`settlement-complete` admin action).
3. **Integration outbox** marks done without external I/O.
4. **No API rate limiting** — OTP brute-force surface.
5. **Guest notification bell** uses mock data (confusing for demos).

### Strongest implemented modules

- Fractional purchase + jeweller verify (counter OTP + UPI path)
- Gold sellback + UPI payout path
- Gold deposit intake + counter OTP
- Vault / GoldUPI / transfers
- Marketplace catalog + gold ticker + admin moderation
- Cross-redemption state machine + jeweller inbox
- Admin KYC/KYB review modal

### Weakest areas

- Golden scheme customer enrollment
- Gold loans
- Admin treasury/settlements UI
- Payment gateway / card checkout
- SMS authentication
- Automated inter-jeweller settlement

### Recommended next development order

1. Payment gateway + webhook reconciliation (fractional + marketplace checkout).
2. Wire `CustomerVaultRedemptionShopPanel` or remove dead code; complete vault ornament redemption UX.
3. Rate limiting + OTP hardening + password reset.
4. Replace integration outbox stub; operationalize settlement batches.
5. Golden scheme MVP (enrollment + ledger) or hide jeweller disclosure until ready.
6. CI pipeline + expand integration tests.
7. Remove or gate demo catalog merges in production builds.

---

*This master document is the entry point. All claims trace to files under `backend/` and `frontend/` as of audit date.*
