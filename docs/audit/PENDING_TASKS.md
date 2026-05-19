# Cridora India — Pending Tasks

Prioritized from **actual implementation gaps** in the codebase audit (2026-05-19).

---

## HIGH PRIORITY

| Task | Why needed | Dependencies | Complexity |
|------|------------|--------------|------------|
| Integrate payment gateway (Razorpay/Cashfree/Stripe India) with webhooks | Manual UTR is not production-safe; reconciliation risk | Legal/merchant account, backend webhook views, frontend checkout | **Large** |
| Wire or remove `CustomerVaultRedemptionShopPanel` | Backend redemption API exists; customer UX gap | Route/section in CustomerDashboardPage | **Small** |
| API rate limiting on auth + OTP endpoints | Brute-force risk on counter OTP and login | Django middleware or DRF throttling | **Medium** |
| Password reset flow (email) | Users cannot recover accounts | SMTP or transactional email provider | **Medium** |
| Production-disable demo catalog merge | Fake SKUs confuse QA and users | Env flag `VITE_ENABLE_DEMO_CATALOG=false` | **Small** |
| Implement real integration outbox processor | Cross-redemption side effects are no-ops | External services definition | **Large** |
| CI pipeline (test + build + deploy) | No `.github/workflows` today | GitHub Actions, test DB | **Medium** |
| Persistent media volume on Railway | KYC uploads lost on redeploy without volume | `DJANGO_MEDIA_ROOT` mount | **Small** |

---

## MEDIUM PRIORITY

| Task | Why needed | Dependencies | Complexity |
|------|------------|--------------|------------|
| Admin treasury / settlements UI (`fin_hub`) | Backend settlement MVP exists; ops blind | Settlement APIs exposure | **Medium** |
| Golden scheme MVP (enrollment + ledger) or hide jeweller disclosure | Customer section shows Coming Soon; jeweller can enable misleading disclosure | New models/APIs or feature flag | **Large** |
| Gold loan MVP or remove ticker loan fields + UI | Placeholder UI; config fields imply false capability | Credit policy, loan models | **Large** |
| Default jeweller picker in marketplace UI | Backend `default_jeweller` ready | PATCH API wiring in grid | **Small** |
| Replace guest mock notifications with empty state or login prompt | Misleading UX on public pages | NotificationBell refactor | **Small** |
| Expand integration test suite (marketplace, redemption) | Only accounts tests today | pytest/DRF APITestCase | **Medium** |
| DRF permission classes per role | Reduce authorization bugs in new endpoints | Refactor views | **Medium** |
| Email verification on signup | Reduce fake accounts | Email provider | **Medium** |
| `auth/me/` on app bootstrap | Stale KYC status in UI | AuthContext change | **Small** |
| Document Railway cron jobs in repo | Ops knowledge in dashboard only | `docs/RAILWAY_CRON.md` | **Small** |

---

## LOW PRIORITY

| Task | Why needed | Dependencies | Complexity |
|------|------------|--------------|------------|
| SMS OTP login using `PhoneOTPChallenge` | Model scaffolded | SMS provider (MSG91, etc.) | **Large** |
| Split `AdminDashboardPage` into feature modules | Maintainability | Refactor only | **Medium** |
| React Query or SWR for data fetching | Less boilerplate, caching | New dependency (needs approval) | **Medium** |
| Remove deprecated `GoldTickerConfig.admin_markup_*` usage | Schema cleanup | Migration | **Small** |
| Fetch jeweller `gold_rate_external_api_url` | Field unused | External API contract | **Medium** |
| iOS Capacitor target | Android only today | Apple dev account | **Large** |
| Root README.md | Onboarding friction | Copy from READMEv2 | **Small** |
| Admin programs & risk dashboard (`mkt_programs`) | Placeholder section | Product spec | **Large** |
| WebSocket for ticker/notifications | Nice-to-have realtime | Channels infrastructure | **Large** |

---

## Recommended development order

1. Payment gateway + webhook reconciliation  
2. Security hardening (rate limits, reset password, demo catalog flag)  
3. Vault redemption UI wiring + remove dead code paths  
4. CI/CD + media persistence  
5. Settlement/treasury admin UI tied to existing MVP commands  
6. Golden scheme OR hide until ready  
7. Golden path expansion (loans, SMS OTP) only after core payments stable  

---

*Cross-reference: [FEATURE_STATUS_REPORT.md](./FEATURE_STATUS_REPORT.md) § Gap analysis.*
