# Cridora India — Security & Risk Report

**Scope:** Implemented auth, API protection, uploads, KYC, role checks.  
**Not performed:** Penetration test, dependency CVE audit, infrastructure review.

---

## 1. Authentication security

| Control | Status | Notes |
|---------|--------|-------|
| Password validators | ✅ | Django default validators enabled |
| JWT access lifetime | ✅ | 8 hours |
| Refresh rotation + blacklist | ✅ | `BLACKLIST_AFTER_ROTATION` |
| HTTPS cookies (production) | ✅ | `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` when `DEBUG=False` |
| Secret key from env | ⚠️ | Defaults to `dev-insecure-change-me` if unset |
| Password reset | ❌ | Not implemented |
| MFA | ❌ | Not implemented |
| Account lockout | ⚠️ | Admin freeze sets `is_active=False` only |

### Token storage (frontend)

- Access/refresh tokens in **`localStorage`** — vulnerable to XSS. Mitigation: strict CSP and no inline scripts (verify deployment headers).

---

## 2. API protection

| Control | Status |
|---------|--------|
| Default `IsAuthenticated` | ✅ |
| JWT on protected routes | ✅ |
| CORS allowlist | ✅ Configurable via `CORS_ALLOWED_ORIGINS` |
| CSRF for API | N/A for JWT Bearer (session not used for API) |
| Rate limiting | ❌ **Not implemented** |
| Request size limits | ✅ 8MB upload cap |

### Public (AllowAny) endpoints

| Endpoint | Risk | Mitigation |
|----------|------|------------|
| `GET /health/` | Low | Information disclosure minimal |
| `POST /auth/login/`, `register/` | Medium | Brute force — **needs throttling** |
| `GET /marketplace/*` public | Low | Intended public catalog |
| `GET /gold/pay/<upi>/` | Low–Medium | User metadata exposure — validate no PII leak |
| `GET /push/vapid-public-key/` | Low | Public key is public by design |

---

## 3. Authorization & role bypass risks

### Pattern

Authorization is **manual** in each view:

```python
if request.user.user_type != User.CUSTOMER:
    return Response(..., status=403)
```

### Risks

| Risk | Detail |
|------|--------|
| Inconsistent admin checks | `user_is_platform_admin()` vs raw `is_staff` on cross-redemption admin |
| No object-level permissions | Jeweller could attempt ID guessing on order PKs — **must verify** each view filters by `request.user` |
| Superuser auto-admin | `sync_staff_superuser_to_platform_admin` on login — intended but broad |
| KYC gate bypass | Endpoints without `kyc_status == verified` check — audit per money flow (fractional/sellback/redemption gate verified in services) |

**Recommendation:** Introduce DRF permission classes: `IsCustomer`, `IsJeweller`, `IsPlatformAdmin`, `IsKycVerified`.

---

## 4. OTP handling

| OTP type | Storage | Expiry | Attempt limits |
|----------|---------|--------|----------------|
| Fractional counter | `code_hash` | Configurable TTL | Implemented in service |
| Gold deposit | `code_hash` | Yes | Service-level |
| Sellback cash | `code_hash` | Yes | Service-level |
| Cross-redemption source | `code_hash` | Yes | Service-level |
| SMS (`PhoneOTPChallenge`) | Unused | — | — |

**Risks:**

- No global rate limit on OTP **generation** endpoints.
- 6-digit OTP entropy — acceptable with attempt limits and short TTL if enforced.

---

## 5. Input validation & file uploads

| Area | Status |
|------|--------|
| KYC document upload | Multipart; size limit `PERSONAL_HOLDING_MAX_UPLOAD_BYTES` / 8MB |
| Personal holding documents | Same |
| Product images | Jeweller upload endpoints — verify MIME/extension validation in views |
| JSON fields | `metal_pricing_json` — validate schema to prevent oversized payloads |

**Risks:**

- Malicious file upload if content-type not verified server-side.
- Media served from `/media/` in production via Django view — ensure auth on **download** endpoints (personal docs use authenticated download).

---

## 6. KYC security

| Control | Status |
|---------|--------|
| Documents stored on filesystem | ✅ |
| Admin-only review APIs | ✅ Platform admin |
| Absolute URLs for docs | `DJANGO_PUBLIC_BASE_URL` — ensure HTTPS in prod |
| PII in admin modal | Full access for platform admins — expected |

**Risks:**

- KYC images accessible if media URL guessed — production should use signed URLs or auth-protected media for sensitive docs (current: `FileSystemStorage` + path — **verify** `MEDIA` serving rules in `urls.py`).

---

## 7. Payment & financial integrity

| Risk | Severity |
|------|----------|
| Manual UTR confirmation | **Critical** for production fraud |
| No double-entry audit for all flows | Medium — liability ledger helps |
| Demo card checkout | Low if blocked server-side — **verify** server rejects `card_demo` on confirm |
| Integration outbox stub | High for cross-redemption external deps |

---

## 8. Critical vulnerabilities summary

| ID | Issue | Severity |
|----|-------|----------|
| SEC-01 | No API rate limiting | High |
| SEC-02 | Manual UPI/UTR without PSP verification | Critical (business) |
| SEC-03 | JWT in localStorage (XSS exposure) | Medium |
| SEC-04 | Default insecure `DJANGO_SECRET_KEY` in dev | High if deployed misconfigured |
| SEC-05 | Inconsistent admin authorization | Medium |
| SEC-06 | Public gold pay metadata endpoint | Low–Medium |
| SEC-07 | No password reset | Medium |
| SEC-08 | Outbox stub gives false sense of async safety | Medium |

---

## 9. Security readiness checklist

| Item | Ready? |
|------|--------|
| Auth for production | ⚠️ Add reset + throttling |
| Authorization model | ⚠️ Refactor to permissions |
| Payments | ❌ |
| Audit logging | ⚠️ Partial (cross-redemption events, liability ledger) |
| Secrets management | ⚠️ Env-based; no committed secrets found |
| Dependency scanning | ❌ No CI |

**Estimated security readiness: 52%** (aligned with master health report).

---

*Deployment hardening: [DEPLOYMENT_AND_ENV_REPORT.md](./DEPLOYMENT_AND_ENV_REPORT.md).*
