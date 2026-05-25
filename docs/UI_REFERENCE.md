# UI reference (webpages alignment)

Production styling matches the static prototypes **`webpages/index.html`** (public) and **`webpages/customer-dashboard.html`** (dashboard).

## Imports (order)

In [`frontend/src/App.tsx`](../frontend/src/App.tsx):

`index.css` → [`reference-tokens.css`](../frontend/src/styles/reference-tokens.css) → [`reference-legacy-bridge.css`](../frontend/src/styles/reference-legacy-bridge.css) → `jeweller-unified-desk.css` → `tokens.css` → `ds.css` → [`reference-ui.css`](../frontend/src/styles/reference-ui.css) → `malayalam-locale.css`.

## Tokens and theme

- **`reference-tokens.css`** — canonical variables (`--gold-*`, `--page`, `--s0`–`--s3`, `--ink*`, dashboard chrome `--fw`, `--th`, `--bh`).  
- **`reference-legacy-bridge.css`** — maps legacy app variables (`--text`, `--border-soft`, `--dash-shell-bg`, …) onto the reference palette so existing CSS and inline styles stay consistent.  
- **`ThemeContext`** — `dark` \| `light`, persisted as **`crdr_theme`** in `localStorage`; sets `html[data-theme]`. **`ThemeToggle`** drives the knob control in public header and dashboard top bar.

## Public shell (`pub-ref`)

[`PublicLayout.tsx`](../frontend/src/components/PublicLayout.tsx): fixed **`.nav`**, mobile **drawer** + backdrop, **`pub-ref__ticker-sticky`** wrapping **`GoldTickerStrip`**, **`public-main`**, **`pub-footer`**.

## Dashboard shell (`ref-dash-shell`)

[`DashboardLayout.tsx`](../frontend/src/components/DashboardLayout.tsx) uses prototype class names:

| Class | Purpose |
|--------|---------|
| `.shell` | Root |
| `.sidebar` (+ `.is-open`) | Sidebar; **`.overlay.is-open`** for backdrop |
| `.sb-logo`, `.sb-user`, `.sb-nav`, `.sb-foot` | Sidebar blocks |
| `.col` | Main column |
| `.topbar`, `.tb-burger`, `.tb-crumb`, `.tb-end` | Sticky header (burger opens sidebar on mobile) |
| `.subnav`, `.snpill` / `.is-on` | [`DashboardMobileSubNav`](../frontend/src/components/DashboardMobileSubNav.tsx) |
| `.main.dash-content` | Content (`max-width: 1200px`) |
| `.bnav`, `.btab` / `.is-active` | Bottom hub navigation |

Customer, jeweller, and admin share this shell; role label is **`sb-badge`**.

## Adding a dashboard section

1. Register the section in the appropriate nav groups (e.g. `CUSTOMER_NAV_GROUPS`).  
2. Panel markup renders inside the layout **`main`** automatically.  
3. Prefer **`card`**, **`btn`**, **`btn-primary`**, **`input`** so bridged tokens apply.

## Marketing sections

Prefer utilities in **`reference-ui.css`**: **`.section`**, **`.section-sm`**, **`.inner`**, **`.quote-banner`**, **`.india-grid`**, **`.trust-grid`**, **`.eyebrow`**, **`.sh`** — see **`HomePage`** for examples.

## Safe areas

**`public-bottom-nav`** and **`bnav`** respect `env(safe-area-inset-*)` where configured in **`reference-ui.css`**.
