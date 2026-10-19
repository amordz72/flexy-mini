# Ooredoo confirmed PIN balance USSD — 2026-10-19

## Owner decision (binding)

- Exact confirmed code: `*200*{pin}#` for Ooredoo Flexy/distributor balance inquiry.
- Purpose: **BALANCE**, not recipient recharge and **not SIM phone-number discovery**. Historical ordinary Ooredoo `*200#` preserved unchanged.
- The template uses `{pin}` as a secret placeholder; the actual PIN stays in Supabase Vault. Never embed it in UI, repository or logs.
- The server/Supabase owns the operation, SIM type binding, authorization, command, deduplication and interpretation; Windows Agent only performs USSD transport and returns raw network data.
- Exact applicability mapped to `ooredoo-flexy` and `ooredoo-flexy-gros`; `enabled=true`, `auto_allowed=false` pending explicit user-initiated reading. No carrier-wide operator guessing.

## Implementation / evidence

1. Developer canonical source: [TELECOM-SERVICE-CODES.md](https://github.com/amordz72/developer/blob/main/telecom/TELECOM-SERVICE-CODES.md), reaffirmed by owner 2026-10-19.
2. Canonical MyTool private registry already had matching code (knowledge `confirmed`); [20261019181000 MyTool migration](https://github.com/amordz72/mytool-dev/blob/main/supabase/migrations/20261019181000_ooredoo_flexy_pin_balance_bindings.sql) applied to Supabase and verified both exact SIM-type bindings. No other Ooredoo codes removed.
3. [Station Connect PR #29](https://github.com/amordz72/station-connect/pull/29) adds server-owned admin-only `station_connect_admin_queue_ooredoo_pin_balance`, `station_connect_admin_ooredoo_pin_balance_job`, exact hardware/PIN-vault command workflow with `ussd_start` then `ussd_release`, raw evidence and 2-minute request deduplication. Both DB migrations applied and compiled. SQL checked admin RPC permissions (authenticated permitted, anon denied), presence of progress trigger, and **zero** Ooredoo balance jobs immediately after installation. PR source is draft / not merged; Station CI failed before any steps. The deployed database still contains those function definitions.
4. [Flexy Mini PR #55](https://github.com/amordz72/flexy-mini/pull/55) changed existing React/Ant Design Stations/SIM view: adds **معرفة رصيد أوريدو (*200*PIN#)** button under the SIM service PIN controls, displays read job/RAW response, removes false older warning and keeps phone-number discovery separate. Merged into main commit `7bec91b1454275be988068c80c81f68b558e0eb2` after [Development Guard CI passed](https://github.com/amordz72/flexy-mini/actions/runs/39291507754) (architecture fixtures, full Node behavior suite, TypeScript and production build).
5. [GitHub Pages run 39291869789](https://github.com/amordz72/flexy-mini/actions/runs/39291869789) completed SUCCESS for that main commit; installed Android PWA cache acceptance is separate.

## Unverified / next single test

- **NO physical USSD was dispatched** by code registration, migrations or UI deployment; the initial live Ooredoo balance RAW reply and its parsing into an account balance remain unverified.
- The server marks a raw received reply as `review` / `OOREDOO_BALANCE_RAW_REQUIRES_PARSER`, not an invented confirmed numeric balance. No financial 585/590 or customer-wallet mutation.
- Open installed PWA or web `/flexy-mini/` and refresh to main SHA `7bec91b...`; in **المحطات والشرائح** locate actual recognized Ooredoo SIM with service PIN and approved online station. Tap **معرفة رصيد أوريدو (*200*PIN#)** **once** and observe returned RAW + release. If no reply, inspect the exact job/command statuses and review, never blindly resend or reclassify.
- After gathering verified carrier response, implement narrowly scoped parser and actual balance snapshot/reconciliation without touching the unrelated Ooredoo phone-number guard.
