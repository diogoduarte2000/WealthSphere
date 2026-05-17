# WealthSphere – Progress Tracker

## Overview
This document records the current state of the **WealthSphere** platform, what has been completed, what is still pending, and a brief version history. It is updated after each significant change performed by the AI or the developer.

---

## ✅ Completed Changes (chronological)

- **2026‑05‑14** – Implemented full **Rendas & Imóveis** UI with tabbed layout (Imóveis, Rendas, Crédito, Analytics, INE). Added stat cards, property cards, expense handling and INE calculator.
- **2026‑05‑15** – Fixed duplicate `totalRents` getter in `dashboard-user.component.ts` (resolved TS2300 compilation error).
- **2026‑05‑16** – Added nested property fields (`typology`, `location`, `currentValue`, `status`, `contract`, `credit`) to the **addProperty** backend handler and updated the Mongoose `User` schema accordingly.
- **2026‑05‑16** – Updated repository with a commit `c1bd5ef` ("fix: save all nested property fields …").
- **2026‑05‑16** – Adjusted frontend to use the new fields (cards now display Valor Atual, Renda bruta, Crédito, Inquilino, etc.).
- **2026‑05‑17** – Verified that the backend now persists all nested fields correctly.
- **2026‑05‑17** – Added basic **progress.md** file (this document) to keep track of future work.

---

## 📋 Pending Work (by impact level)

### P0 – Critical security / functional blockers
- **Steam token in query string** – should be sent via POST body or Authorization header. (Refs: `dashboard-user.component.ts:313`, `backend/server.js:241`)
- **Auth interceptor injects bearer token on all HTTP requests** – may leak token to external APIs. (Refs: `auth.interceptor.ts`, `rates.service.ts`)
- **Refresh token flow missing** – No `/api/auth/refresh` or `/api/auth/logout` endpoints. (Refs: `auth.component.ts`, `dashboard-user.component.ts`)
- **Password hash exposed on PATCH `/api/users/me/settings`.** (Refs: `backend/server.js:422`, `User.js`)

### P1 – Important functional / UX gaps
- **Forum service token mismatch** – reads `token` from `localStorage` while login stores `wealthsphere_access_token`. (Refs: `forum.service.ts`, `auth.component.ts`)
- **Placeholder pages** – `income.html`, `simulador.html`, `taxas.html`, `mercados.html`, `perfil.html`, `definicoes.html` still empty.
- **Rates service still uses mock data / TODO** – real‑time rate fetching not finalized.
- **SPA navigation links use `href="index.html"` instead of `routerLink`.** (Refs: `dashboard-demo.component.html`, `dashboard.html`)
- **Session cookie configuration (dev secret, `saveUninitialized:true`, `secure:false`).** Needs hardened settings for production.

### P2 – Polish / refactor / consistency
- **Repository drift** – Multiple entry points (`server.js`, `backend/server.js`, `src/`) causing confusion. Align to single entry point (`backend/server.js`).
- **Linking to external services** – Ensure CORS and CSP headers are set appropriately.
- **Add unit / integration tests** for auth flow, property CRUD, and security checks.

---

## 📅 Version History (high‑level)

| Version | Date       | Tag / Commit | Highlights |
|---------|------------|--------------|-----------|
| 0.9.0   | 2026‑05‑14 | –            | UI for Rendas & Imóveis, tabbed layout, INE calculator.
| 0.9.1   | 2026‑05‑15 | –            | Fixed duplicate `totalRents` getter (TS2300).
| 1.0.0   | 2026‑05‑16 | `c1bd5ef`    | Backend `addProperty` now persists all nested fields; schema updated.
| 1.0.1   | 2026‑05‑17 | –            | Verified persistence, updated frontend bindings.
| 1.1.0   | 2026‑05‑18 | –            | **This** progress document created; security audit list compiled.

---

## ✅ Next Steps
1. **Implement P0 fixes** – move Steam token to POST body, tighten interceptor, add refresh/logout endpoints, stop returning password hash.
2. **Resolve P1 items** – sync forum token, replace placeholder pages, finish rates service.
3. **Finalize production‑ready session & cookie settings.**
4. **Add automated tests** for critical paths.
5. **Update documentation** (README, API spec) to reflect new endpoints and security improvements.

---

*This file is intentionally kept simple so that the AI can read and update it without needing to parse complex markdown tables.*
