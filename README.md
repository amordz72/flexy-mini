# Flexy Mini — الخدمة والواجهة المشتركة للفليكسي

**Status (2026-10-13): WORKING SOURCE / PRODUCTION DATA INTEGRATION PRESENT / END-TO-END FINANCIAL ACCEPTANCE PENDING**

This README replaces the historical v0.3/v0.5 scaffold description. **Flexy Mini is no longer an empty proof of concept.** The installed PWA has shown the Flexy page, offer catalog, stations and SIM details. This alone does not prove a successful end-to-end live recharge from the current application.

## Read first — one canonical behavior map

**[SYSTEM-BEHAVIOR-MAP.md](docs/SYSTEM-BEHAVIOR-MAP.md)** is the project-local reference for:
- Intended end-user and admin workflows; the difference between customer number, SIM identity, offer family, route and source.
- Current UI, Station Connect, database and reusable hardware-service ownership.
- Cached discovery → verified group → canonical catalog → route → confirmed job → result.
- **Automatic per-SIM balance policy:** initial network baseline, cumulative successful outflows, reconciliation and low-balance alerts.
- What exists in source or DB, what has historical evidence and what still needs live verification.
- Known mismatches, unsupported functionality and exact next validation steps.

**Any developer/AI must start with [AGENTS.md](AGENTS.md), the behavior map, and the linked policies before changing financial or station behavior.** New results are recorded there with proof, not guessed from old comments.

## Product today

- Stack: **Refine + React + TypeScript + Vite + Ant Design + Supabase**; PWA served via GitHub Pages.
- **One shared interface** for administration and customers; rights are the difference, not a second dashboard.
- `src/main.tsx`: navigation, session/layout.
- `src/FlexyServicePage.tsx`: existing Flexy service, recipient phone, offers/ordinary credit tabs, offer selection and confirmed administrator send.
- `src/CustomerOfferIdentity.tsx`: recipient offer group from valid discovery cache, with explicitly requested discovery session via Sama.
- `src/StationOverview.tsx` and `src/SamaOperationalActions.tsx`: station/modem/SIM diagnostics and configuration, approval/read-balance fallback.
- `src/SamaOfferDiscoveries.tsx`: history of discovery inside Flexy, **not a separate selling page**.
- `src/BuildCopyButton.tsx`: tells which build actually reached the user's PWA.

Live Supabase contains Station Connect Jobs, Sessions/Commands, historical discovery results, canonical offer catalogs, SIMs and balance-account logic shared with other projects. **Do not create duplicate financial/master tables or change MyTool business data as a UI side-effect.**

**Known limitations as of this document:**
- **Sama-first → Arsselli fallback policy (approved 2026-10-13):** the server selects an eligible Sama route for an active Mobilis offer, else an independently verified and enabled Arsselli route supporting the **same** offer *before* any financial network send. No automatic second financial attempt on failure/unknown. Network failure with confirmed no execution shows «يرجى المحاولة بعد حين»; uncertain result remains REVIEW. The current Arsselli offer routes remain draft/disabled in production; the ordinary Arsselli 696 sender is **not** an offer replacement. The UI now probes `station_connect_admin_offer_route_preview`; the financial send remains Sama-only until a true verified Arsselli **offer** executor and route are tested. Do not claim live fallback works yet.

- Customer wallet-backed financial send and secure customer discovery endpoint are not complete.
- Ordinary balance recharge is not available from the Sama-only pilot route.
- Backend verification of recipient group is present, but multi-source router/UI and multi-modem binding require further validation.
- The established cumulative balance DB core exists; **automatic initial balance discovery and deduplicated low/empty alerts are not yet proven operational from this UI**. Manual balance button is fallback, not intended daily workflow.
- Approval of the physical SIM is an explicit security action; routine balance reconciliation should not require repeated admin button clicks.
- Recorded Jobs from September establish historical Station Connect activity, **not success of a financial transaction from the current Flexy Mini release**.
- The source Agent's version can differ from the installed Windows Agent. Never conflate their SHA/version.

## Ownership and cross-project contracts

| Repo | Owner of |
|---|---|
| [flexy-mini](https://github.com/amordz72/flexy-mini) | Product UI, UX, permitted application-level RPC entry points |
| [mytool-dev](https://github.com/amordz72/mytool-dev) | Current Flexy policy, shared catalog/routes, operational balance model and MyTool business systems |
| [station-connect](https://github.com/amordz72/station-connect) | Outbound Windows Agent, station identity, Job/Session/Command backend and USSD hardware execution |
| [station-services](https://github.com/amordz72/station-services) | Reusable HiLink/Windows/network components (real PC testing must be verified separately) |
| [developer](https://github.com/amordz72/developer) | Central decisions, evidence and next-step index; **not executable runtime** |
| [tehna-connect-core](https://github.com/amordz72/tehna-connect-core) and previous Tehna repos | History and lessons, not the live implementation target |

Binding domain policy: `amordz72/mytool-dev/flexy/policy/CURRENT-POLICY.md` and `SOURCES.md`. Cross-project discovery and balance docs are linked directly from the **behavior map**.

## Local run (development only)

```bash
npm install
cp .env.example .env.local
npm run dev
npm run build
```

Configure **Supabase project URL and public/publishable key only**. Never add a `service_role` key, SIM PIN or card secret to the browser, Git history or documentation.

## Deployment & acceptance

- GitHub Pages base path is `/flexy-mini/`, with deployment via repository GitHub Actions.
- A successful commit alone is **not** evidence of PWA update: check build result and **copy the deployed build SHA** from the actual phone.
- Before claiming a feature complete, distinguish: `SOURCE EDITED` → `DB MIGRATION APPLIED` → `BUILD PASS` → `PHONE PWA VERIFIED` → `AUTH/ROLE TEST` → `LIVE STATION TEST` → `MONEY TEST (explicit approval)`.
- Never issue surprise USSD or real voucher/recharge transactions as part of a code/doc edit.
- For an uncertain financial result, do **not** auto-retry with a new idempotency key.

## Historical scaffold note

The original README described `Refine pilot / v0.3-v0.5 / no Station integration`. That was correct **only for the early scaffold**, and is superseded by verified October 2026 source. It must not be used as the current architecture reference.
