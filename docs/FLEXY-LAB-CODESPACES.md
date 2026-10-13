# Flexy Mini — isolated Codespaces simulator

**State:** WORKING LAB BRANCH, not production, not published.  
**Branch:** `lab/flexy-simulator-20261013`  
**Owner:** Same real `src/FlexyServicePage.tsx` and `src/CustomerOfferIdentity.tsx` used by the existing product. No forked Flexy page.

## Open on Android without updating production

1. Tap **[Create/resume private Codespace](https://codespaces.new/amordz72/flexy-mini/tree/lab/flexy-simulator-20261013?quickstart=1)**, sign in to GitHub and select **Create codespace** if requested. Only the repository owner can do this, and it consumes GitHub Codespaces quota.
2. The devcontainer installs npm packages and starts Vite on port `5173`. Under the **PORTS** tab, open port 5173. Keep it **Private**.
3. Open the URL ending **`/flexy-mini/demo.html`** (if your forwarded port URL redirects to `/flexy-mini/`, append `demo.html`). Example: `https://YOUR-CODESPACE-5173.app.github.dev/flexy-mini/demo.html`.
4. At the top, generate a fake `05XXXXXXXX` number or enter your own **test-only** number; choose PixX, Revolution or Sama, and the simulated transaction result.
5. On the **real reused Flexy UI below**, press **عروض** once. The mock checks localStorage and creates exactly one fake discovery if needed. Select an eligible offer, then use the usual financial confirmation (clearly marked mock-only).
6. Results/jobs/phone-group cache persist under `flexy_mini_simulator_v1` in that Codespace browser's localStorage; `مسح التجارب` clears only mock keys. No production PIN, phone history or balances are copied.

## Constraints and evidence

- `demo.html` is an **alternate Vite entry**, not linked from `index.html` and not included in the existing Pages deployment. On `main` there is **no** simulator entry.
- `src/demo/mockDb.ts` is a fail-closed, browser-local implementation of the exact RPC names used by Flexy UI. **No** Supabase client creation, remote URL, network `fetch`, API key, Station command, actual USSD or charge.
- The same React Flexy components are rendered. The lab-only optional `simulation`, `initialPhone` and `onPhoneChange` props customize only test text, initial phone, and scenario control.
- The 26 active Mobilis catalog entries are a **13 Oct 2026 snapshot** of MyTool `public.flexy_offer_catalog`. Synthetic IDs; amounts, family labels and known presentation details match the snapshot. It is **not live catalog synchronization** or proof of physical route availability.
- Discovery classification cache defaults to 7 days; every new generated number gets a deterministic demonstration group. Changing it in the lab panel erases only its cached classification so the next عروض click discovers it again.
- Unknown mock RPCs error; the adapter must never delegate to a live Supabase DB. New page functions need explicitly mocked APIs and an automated test, not a silent fallback.
- The production client may be newer or older: this lab branch starts from the current main at the date of creation. **Never merge without comparing `main` first and running all tests.**
- GitHub Pages remains **main only**. Branch push workflow `lab-simulator-check.yml` runs source unit tests, simulator contract tests and TS/Vite build. The existence of a workflow is not proof it passed; check Actions before acceptance.
- This lab retains the main UI's current offer-specific send prerequisites for selection but performs only **fake transactions**. Route eligibility is simulated, **not a proof of financial readiness**.

## Commands in the Codespace terminal

```bash
npm run dev -- --host 0.0.0.0
npm test
node --test tests/lab-simulator.test.mjs
npm run build
```

## Decision gate

Stage 1: mobile tests of `/flexy-mini/demo.html` + parity with real Flexy component.  
Stage 2: screenshot+behavior acceptance by user.  
Stage 3: optional safe extraction of common mock/live service interface in a reviewed PR; **do not merge the lab-only adapter or mock-data entry into production by accident**.  
Stage 4: deploy one verified change to real Flexy Mini after separate approval.  

For ongoing development instructions, read `amordz72/developer/AGENTS.md`, `NEXT-STEP.md` and `flexy-mini/docs/SYSTEM-BEHAVIOR-MAP.md` first.
