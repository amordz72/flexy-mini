# Flexy Mini — execution architecture audit (2026-10-14)

Status: audit and design baseline only. NO production deployment, NO financial command.

## Verified in code
- Legacy tehna-connect-core: `SimPinController` -> `ModemRegistry::saveServicePin` -> Laravel `Sim` model with `service_pin => encrypted` cast. This stores the encrypted PIN in the Laravel database; it is NOT proof of Agent-local storage.
- Current station-connect: `station-gateway/index.ts` returns `runtime_secrets.service_pin` to the authenticated Agent for legacy workflow claims. Thus PIN can transit the gateway, and cannot be described as Agent-only in the current implementation.
- Current station-connect: `station_connect_sims.pin_secret_id` is a secret reference; command queue has `secret_key`; confirm actual secret-resolution path and access controls before migration.
- Current station-connect: `orchestrators.ts` already supports `execution_profile`, `value_template`, `renderRuntimeTemplate`, `ussd_start/reply/release`.
- Legacy tehna-connect-core: `ExecutionOptionService` separates Sama network index/path template from Arsselli amount; `config/discovery.php` has `start_template`.
- `station-connect` commit c26ea007 adds a special-case Arsselli 696 orchestrator; not approved as the long-term architecture. Do not deploy before comparison with generic execution profiles.

## Agreed responsibility boundaries
- Flexy Mini UI: request fields and results only; no service PIN, USSD assembly or confirmation logic.
- Supabase: authoritative SIM identity by ICCID, approved template versions, service definitions, execution history and access control. Secrets require dedicated protected handling.
- Station gateway: resolve typed variables from their authoritative sources, validate immutable execution snapshot, orchestrate steps, correlate network responses, prevent duplicate financial commands.
- Agent: identify modem/SIM, execute bounded USSD steps, return raw response, maintain active modem session; no business policy.
- Secret ownership is an OPEN DECISION. User prefers encrypted local Agent PIN bound to ICCID. Existing legacy and current implementations differ. Never silently migrate PIN or assert it is already local.

## Typed variables and sources
- phone, amount: validated user request
- service/offer selection: validated UI request and approved catalog
- sim_uuid / ICCID: station SIM registry
- station_uuid / modem_uuid: current routing and online binding
- account: approved distributor configuration
- network_index: discovered network menu matched to approved offer
- service_pin: protected secret associated with ICCID, never browser or logs
All values must be resolved server-side into one auditable immutable job snapshot. Do not allow arbitrary template code execution.

## Before implementation
1. Inspect all current RPCs/DB tables and old execution/discovery/Arsselli templates; identify canonical tables to reuse.
2. Trace actual PIN lifecycle, encryption-at-rest, secret access, and SIM migration across stations.
3. Trace one full USSD job start/reply/release and stale-session expiry, including idempotency and uncertain results.
4. Reuse generic execution_profile instead of hardcoded 696 branching where supported.
5. Add tests for missing variables, wrong SIM, wrong phone/amount confirmation, expired sessions, duplicate callbacks, PIN secrecy.
6. Only then implement, test and deploy; never replay job 80d6e727-6988-4274-a475-a384d5bab0ca.

## Verified against live Supabase schema (2026-10-14)
Read-only inspection confirms `station_connect_sims.iccid`, `station_connect_sims.pin_secret_id`, `station_connect_commands.secret_key`, and discovery `route_template` fields. Existing RPC names include `station_connect_begin_command_session`, `station_connect_claim_command`, `station_connect_complete_command`, `station_connect_queue_session_command`.

## Existing secret resolution path (repository SQL)
In `station-connect/server/supabase/migrations/20260919_021_session_command_queue.sql`, `station_connect_claim_command` resolves `secret_key='service_pin'` via `vault.decrypted_secrets` using the SIM's `pin_secret_id`, then returns the command value to the authenticated station. Thus Vault is the central secret store for this path; Agent receives the decrypted PIN for immediate USSD execution. Confirm the live deployed SQL matches this migration before changing code. Never log the returned value.

## Architecture decision confirmed by user
Keep PIN centrally protected and bound to SIM ICCID; Agent uses it transiently on the correctly bound modem. Avoid any duplicate local PIN registry. Reuse existing Vault reference and command queue. No financial operation authorized by this audit.

## Follow-up audit: profile execution mismatch
- `station-gateway/orchestrators.ts` implements `advanceProfileDrivenMobilisOffer` when `execution_plan.mode='profile_steps_v1'`, but only through `mobilis.offer.execute` dispatch.
- It resolves `{service_pin}` through `queueCommand(...,'ussd_reply',null,'service_pin')`, while other `value_template` placeholders are rendered from `job.payload`.
- It has hard-coded Sama assumptions (`{network_index}` requires a numbered offer menu). The generic step runner must separate response guards by approved service template, not inherit Sama rules for Arsselli.
- Arsselli `mobilis.flexy.arsselli.696` currently has a separate handler (commit c26ea007); keep undeployed until reviewed.
- Safety: validate exact recipient and amount before a financial confirmation; queue each step once, preserve USSD session, do not retry uncertain transactions, and classify result as review absent explicit network success.
- Next implementation should extract reusable profile step advancement, with typed guard/pattern definitions, and adapt both routes through tested profiles. Do not assume a database profile table exists; first locate authoritative existing tables/RPCs.
- Live DB read-only inspection of additional job data was blocked by security checks; no claim about current live job/profile contents.
