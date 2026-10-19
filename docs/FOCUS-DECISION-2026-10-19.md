# Flexy Mini — Owner Focus Decision (2026-10-19)

**OWNER APPROVED: RECORD AND CONTINUE.** Finish the existing Flexy Mini functional path before opening more development branches or adding unrelated features. This decision supersedes competing earlier "next task" suggestions, but does **not** authorize unrequested financial transfers or blind retries.

## Binding execution order
1. **Mobilis ordinary 630**: stabilize the existing production route end to end: matched phone+amount → exactly one confirmation `1` in the SAME network session → observed carrier acceptance → platform's operational result. Transport and physical USSD remain the Station Agent / station-gateway responsibility; *Flexy Mini* owns customer-facing operational acceptance and accounting. No second send for unknown outcome. Distinguish unsent legacy preparations from actual financial review, and avoid rewriting historical jobs.
2. **SIM identity/catalog**: operator → service SIM type → permitted actions / USSD templates. Canonical ICCID stays the physical SIM identity; never bind identity to modem USB/IP. Review Ooredoo number lookup with verified nonfinancial evidence before executing any PIN-bearing code; current Ooredoo lookup remains intentionally blocked, not solved.
3. **Balance quality control**: keep canonical per-SIM, per-distributor operational balance and pending holds; add independent scheduled network reads at 00:00, 06:00, 12:00, 18:00 Africa/Algiers when the modem is idle. Display network snapshot / cumulative spendable / signed delta / timestamp and holds together; do not require a fresh network read before every 630 order; no parallel ledger.
4. **Offers**: finish Sama execution-PIN and carrier-response evidence, then independently verify eligible Arsselli 696 routes. Discovery/route/execute semantics stay separate and bounded.
5. **Master Cards**: preserve Master Card as the only canonical product SKU / commercial stock/code owner. Flexy Mini presents prices and customer access only; purchase stays disabled pending one atomic claim, per-site sale accounting and once-only secure code delivery.

## Read-only evidence at decision time (2026-10-19)
- GitHub main production source before this decision: `c1653929` (manual SIM phone save UI fix; Android installed PWA acceptance still unverified).
- Production `station_connect_jobs` since 2026-10-17 for operation `mobilis.flexy.ordinary.630`: **2 success** with 3 commands and 1 confirmed `ussd_reply` each; **5 failed** with 2 commands and **zero successful `ussd_reply`**; **4 legacy review** marked `630_NETWORK_SEQUENCE_UNVERIFIED` with **zero commands** (unsent preparation, not ambiguous real transfer). Avoid inferring the underlying carrier failure cause from counts alone.
- Latest account network snapshots observed 2026-10-18: GTS 04 = 11 DZD; DATA 03 = 910 DZD. Historical network balances are NOT automatically the live spendable.
- Existing Master commercial stock includes only one `mobilis/1000` card under review, currently 0 available.
- Current code persists a pending credit request/idempotency key before the 630 RPC; full installed-PWA end-to-end verification is still separate.
- No financial USSD was sent, no database mutation, no station approval or cash settlement was performed during this review.

## Immediate next work — strict scope
Read-only verify current installed-facing release/build, then examine **why the historical 630 reply was not submitted** using sanitized existing command/session evidence and current gateway code. Compare failing and successful command sequences; fix a reproducible current bug if proven, otherwise do NOT pretend historical failures still reproduce. In parallel correct any UI presentation that mislabels zero-command legacy staging as a sent financial review. Run focused regression + build / CI when changing source. Actual money sends require an individual in-app user action; never initiate them from the audit. Update this file with the tested next result.
