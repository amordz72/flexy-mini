# Flexy Mini — Sama accordion, catalog visibility, source-aware commercial fallback
Date: 2026-10-13

## User-approved correction
1. **SAMA presentation**: one collapsible `عروض Sama` box, with the Mix / Talk / Net children. It must not expand the page into a long continuous catalog. The recipient's verified group decides which group exists on this page.
2. **PixX and Revolution**: display their own canonical catalog entries as compact single-select rows, with full display_name, amount, and details; do not repeat generic Revolution tiles. Retain existing shared Refine/Ant Design UI, one phone, discovery flow, admin raw-operation table and protected financial confirmation.
3. **Old amount rule superseded**: amount < 500 is not an automatic Arsselli-only rule and is not a reason to hide a role-visible active offer. Sama may execute lower amounts when there is a verified execution route, current recipient group, connected/approved SIM, sufficient balance, secret and an authorized request.
4. **When Sama is missing**: do not hide the service. Try a *verified offer-specific* Arsselli candidate for the **same offer**, with an appropriately lower customer discount determined by a source-aware price/discount quote before confirmation. No guessed flat discount, no silent price change after confirmation, no ordinary-credit substitute, and no assumed route certification. A lower discount should be based on actual acquisition cost/fees, configured margin floor and explicit customer confirmation. Source and quote are operation snapshots.
5. Confirmed failure/unavailability is distinct from dispatched-uncertain REVIEW. Never retry an uncertain financial send automatically.

## Implemented source on 2026-10-13
- `src/FlexyServicePage.tsx` commit `2734383`: Ant Design Collapse for Sama; internal Mix/Talk/Net accordion; List rows for PixX/Revolution with full name, price, radio selection and details Modal. Removes duplicate cards and redundant Mobilis title.
- The client now consumes `flexy_get_visible_offer_catalog_v2` role-allowed Mobilis offers, without `amount >= 500` filter; manual match min is 1 DZD. Role visibility, active state and matching recipient group still come from the server.
- Local tests added in `tests/flexy-recipient.test.mjs`: UI structure, sub-500 catalog, no accidental financial dispatch, full PixX names/detail. Tests are isolated from Supabase/USSD.
- `supabase/migrations/20261013165000_flexy_mini_verified_sub500_offers.sql` commit `f6667388` holds the narrowly-scoped removal of `c.amount>=500` in the verified offer-execute wrapper, retaining admin, fresh recipient discovery, known index, enabled catalog, idempotency and Station execution. **Prepared in GitHub but NOT APPLIED to Supabase**: application tool rejected the attempt. Do not claim that live <500 sending is enabled.

## Read-only database evidence
- Verified source has 18 enabled Sama offer routes; 7 Arsselli offer-specific routes are `draft/disabled`.
- Existing verified-execute wrapper still enforces `c.amount>=500` in production until above migration succeeds.
- No RPC/service currently provides a verified *source-aware customer discount quote*. There is no authorized fallback into 696 ordinary amount recharge for PixX/Revolution.
- Historical reference costs: Sama funded by cards with about 9% purchase discount and 10 DZD per successful send; Arsselli ordinary balance purchase about 4%; these are **snapshots, not retail discount values or hardcoded prices**.
- Frontend financial send is still Sama-only and must not call an unverified Arsselli path. If a route preview nominates Arsselli, message says it needs approved offer execution and pricing.

## Verification levels
- GitHub source/DB read-only: confirmed; no MyTool Master, wallets, SIM identities or operational balances changed.
- Automated tests and Pages deploy: need checking GitHub Actions status; **not yet claimed successful**.
- Phone PWA, real network discovery and financial test: not observed; no USSD/financial command was sent.
- SQL migration: GitHub only, not applied.
- Source-aware discount and Arsselli offer route live execution: approved direction, missing implementation and real verification.

## Next single safe sequence
1. Confirm GitHub Actions test/build/deploy and installed PWA build SHA for UI changes.
2. Apply and verify only the reviewed narrow server sub-500 migration (with read-only introspection/rollback); do not send a financial job automatically.
3. Establish certified same-offer Arsselli execution and a server-owned price quote/cost guard before enabling fallback. Obtain real rate policy settings instead of hardcoding a discount.
4. Only then perform individually authorized physical tests and confirm the operation table, outcomes and no duplicates.
