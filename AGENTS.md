# Flexy Mini — Agent / Developer entry contract

**Applies to all future Flexy Mini changes and technical analysis.**

## Mandatory startup — no reset / no guessing

1. Open `amordz72/developer/AGENTS.md` and `WORKING-CONTEXT.md`.
2. Identify current work from `ACTIVE-PROJECT.md`, `PROJECT_CATALOG.md` and `NEXT-STEP.md`; some old snapshots are dated and must not override current user instruction.
3. **Read this repo's [docs/SYSTEM-BEHAVIOR-MAP.md](docs/SYSTEM-BEHAVIOR-MAP.md) FIRST for Flexy semantics, actual component locations, verified tests and open gaps.**
4. Read `amordz72/mytool-dev/flexy/policy/CURRENT-POLICY.md` + `SOURCES.md` before changing catalog, routes, discovery, execution, finance or recharge; read the Developer Flexy UI mistakes reference before UI work.
5. Inspect the actual current source (and the server RPC definitions for backend effects) before modifying code; previously pasted patches or screenshots are evidence, not the current source of truth.
6. If handling Windows/HiLink, inspect `amordz72/station-connect` and `amordz72/station-services`. Do not add a parallel Node Agent in Flexy Mini.
7. State which level has been verified (source / DB applied / CI / installed PWA / actual station / financial outcome). Never call a DB function existing “live-tested” merely because it was deployed.

## Architecture contracts

- **One UI shared by users and admins; permissions are enforced server-side.** Do not create separate customer/admin layouts or login systems.
- The **Flexy page** sells/requests a service; **Stations and SIMs** is hardware/admin setup only. Live recipient-offer Discovery belongs inside Flexy, not a third selling page.
- **Offer identity** = operator + family + amount. SIM type, modem, network index, available balance, execution route, priority and display group are distinct.
- **Do not combine** discovery, catalog, presentation, execution routing, session transport, recharge-stock and ledger models.
- Reuse the shared Supabase schema/RPCs, and preserve MyTool Master/customer/financial data. Never create competing canonical tables without explicit architecture approval.
- Agent is a thin executor of generic USSD/transport; server is the owner of business classification, safe queueing, routing, results, finance and alerts.
- Validate the **recipient's discovery identity** with a server check for financial operations. Never infer unknown offers as absent.
- Startup **balance baseline discovery should become automatic**, followed by cumulative operational calculations and per-SIM account reconciliation/low-balance alerts. The existing manual button is fallback. Current DB core exists, but end-to-end automation must be proven, not claimed.
- Financial confirmation, idempotency and no blind retries are nonnegotiable. Never send a real USSD/recharge without user authorization.
- Protect PINs/card codes/secret keys; no production phone lists, wallet balances or private credentials in documentation, logs or Git.

## Evidence & updates

For significant work, update `docs/SYSTEM-BEHAVIOR-MAP.md` with:
`user decision | owning repo/component | what changed | source commit/migration | test evidence | what is still unknown | next single verifiable step`.

Keep `amordz72/developer/NEXT-STEP.md` a **short pointer**; it must remain under the Developer Gate 220-line limit. Point to the project-local behavior map instead of copying this file into Developer.

Latest original installed PWA version / Windows Agent version may lag behind GitHub source. Verify them separately. Decisions in older Tehna repositories are historical when superseded by current MyTool policy.
