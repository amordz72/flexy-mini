## 2026-10-17 — Arsselli 630 precise connectivity messaging (SOURCE / PHONE CHECK REQUIRED)

- **Owner correction:** When ordinary-credit 630 preflight has no eligible account because Arsselli Station Connect is offline, the UI must state **"لا يوجد اتصال بمحطة Arsselli"** rather than assuming insufficient distributor balance. A Sama offline warning does not explain Arsselli credit readiness.
- **New Station Connect read-only admin RPC:** `station_connect_admin_arsselli_630_availability(p_amount)`, uses existing 90-second station/modem/SIM health and account selector. Structured reasons differentiate station offline, modem offline, SIM stale, approval/PIN missing, unknown/review/disabled/insufficient distributor balance. Existing 630 preflight reuses the same status.
- **Actual UI behavior:** same `FlexyServicePage` / Ant Design card and common layout; while editing a valid 630 amount, check readiness automatically, refresh every 30 seconds, show the relevant Arabic tag and alert, and require a fresh eligible source before exposing review-only staging. Offers mode keeps its existing Sama indicator. A client↔server network exception is a distinct "cannot verify" state, **not** proof the PC/Agent is offline.
- **Safety:** read-only inspection never dispatches USSD; `630` stage still returns `review/dispatch_enabled=false`, `696` remains separately governed. No balances, accounts, customer policies or shared MyTool tables changed. QA/CI, production deployment and Android PWA acceptance are separate evidence levels.

---

## 2026-10-17 — User confirmed 630 vs 696, settings-based selection (IN PROGRESS)

**User confirmed actual USSD syntaxes from field evidence:** Mobilis Arsselli `630` is **ordinary credit** and requires a distributor account (`*630*{phone}*{distributor}*{amount}*{pin}#`, known minimum 40 DZD); Mobilis Arsselli `696` is **activated offer purchase** (`*696*1*{phone}*{distributor}*{amount}*{pin}#`); Mobilis Sama uses `665` for activated offers. Prior user-provided network evidence establishes *code syntax*, not financial success of the Flexy Mini/Station Connect orchestration. Do not conflate them or force default distributor 04 for all operations.

**User preference, NOT a hard-coded permission or amount ban:** For Mobilis activated offers under the configurable split (currently 500 DZD), prefer **Arsselli 696**; at/above split, prefer **Sama 665**. The second source may be selected **before network dispatch** only when it is a *verified, enabled offer-specific route* and has an eligible online SIM, PIN and sufficient actual account balance. No automatic financial retry after ambiguous/review result. Routing preference does **not** change recipient offer visibility, approval, wallet, customer discounts, acquisition cost or financial success classification. Final customer quote/permissions/profit-based execution criteria are postponed until source-aware costs and account policy have been agreed.

**Code changes:** Station Connect owns `server/supabase/migrations/20261017_mobilis_offer_source_priority_settings.sql`: one private preference row for `mobilis` with configurable split and two source types, two admin-only RPCs for read/edit (optimistic lock + modal confirmation UI in Flexy Mini `src/OfferSourcePreferenceSettings.tsx`). BOTH the server admin route preview and live route selector order *eligible candidate routes* by this one preference; network route/runtime verification and balance checks remain. Existing Arsselli 696 routes are DRAFT/DISABLED; this change does NOT activate them. The commercial priority is stored data, default 500, not a static condition in code.

**Execution capability gates:** Flexy Mini's old backend wrapper amount>=500 *prohibition* was removed by applying existing reviewed migration `20261013165000_flexy_mini_verified_sub500_offers.sql` to production, applied on 17 Oct and readback verified: old guard absent, admin/discovery/idempotency/Station router checks present. This allowed catalog-eligible below-500 Sama offers to reach the route readiness check; it did not create/send any job. Neither an ordinary 630 financial dispatcher nor live 696 offer fallback has been certified within the product. 630 remains non-financial review-only staging and 696 remains experimental/unconfirmed; next real-money test requires explicit test recipient and amount, selected distributor and per-test approval, with terminal network and ledger reconciliation.

**Verification levels:** Current source and read-only DB verified; Station Connect and Flexy Mini feature branches + their CI, migration application and installed-PWA acceptance to be checked separately. Do NOT claim a completed live test based on code or database states. `mytool-dev` remains paused.

---

## 2026-10-17 — USER PRIORITY: finish live Flexy first; freeze package expansion

**OWNER DECISION — no runtime changes in this entry.** The existing Mobilis SAMA catalog/presentation is accepted for this phase. Sama is one presentation group with three existing packages/families (`Sama Mix`, `Sama Talk`, `Sama Net`). Their current collapsible/stacked layout is sufficient; no need to refactor into a table. Existing PixX and Revolution offer lists remain as they are.

**DEFER:** proposing/building `flexy_offer_packages` or any other new package/group tables; extra internet-only / voice-only / mixed classification, editorial display rows, advanced manual family ordering, automatic family-mode machinery, cosmetic redesign, or seeding speculative Djezzy/Ooredoo offers. The foregoing are ideas for a later iteration, not implementation requests or permissions for new migrations.

**DO NOW:** prioritize the operational product: (1) ordinary-credit execution end to end; (2) activated-offer execution end to end; (3) network result classification, safely surfaced success/failure/review, and user acceptance on actual hardware. Preserve strict no-double-send, source/route evidence and customer confirmation. Continue to Djezzy/Ooredoo only once this core path is proven, using real carrier prompts/screens and supplied evidence rather than invented catalogs or network indexes. In Djezzy, present discovered options faithfully to network responses; do not invent categorization. **No real-money USSD without explicit per-test authorization.**

**ACTIVE REPO:** `amordz72/flexy-mini` for product work; `mytool-dev` is currently PAUSED (read existing canonical entity contracts as references only, do not modify that repository). Station Connect can be audited if needed to finish actual execution. This decision does not assert that ordinary/activated execution already works.

---

## 2026-10-17 — Confirmed View Index administration (IMPLEMENTED / PHONE CHECK REQUIRED)

- **Only Flexy Mini active:** MyTool Dev remains paused. Same canonical `public.flexy_offer_catalog.sort_index` holds customer-facing **View Index**; presentation position is independent of execution-route `network_index` and any network USSD screen navigation. Existing admin/catalog RPCs remain the single source for offers; no parallel product, SIM or code registry.
- **Admin UI:** `src/TelecomCatalogAdmin.tsx` now shows a View Index number and `تعديل` instead of numeric 1/2 route-count badges. An Ant Design confirmation modal shows old position, editable new position (1..size of operator+family), and says other offers in the family may shift. Cancellation makes zero DB calls; Save invokes only `flexy_mini_admin_offer_view_reorder`.
- **Server write gate:** `supabase/migrations/20261017150000_flexy_mini_admin_offer_view_index_reorder.sql` adds a single authenticated+admin-only SECDEF RPC; denies anon/unauthenticated, requires expected `updated_at` to prevent stale edits, locks the family, reorders to contiguous `sort_index` values in a single SQL transaction. Existing duplicate/ambiguous positions are normalized only **after user confirmation**. Nothing is silently reordered by installation of the migration.
- **Customer display:** `src/FlexyServicePage.tsx` uses `sort_index` within each existing eligible offer family instead of forcibly ordering by amount. Existing discovery group eligibility, role policy, execution index and financial routing are unchanged.
- **Verified:** GitHub CI tests, UI framework guard and production build passed on branch; DB migration applied and confirmed admin permissions, 27 existing offers unchanged, 25 existing execution routes unchanged. **No phone acceptance and no real admin reorder attempted from the customer's account**: USER_CONFIRM_REQUIRED.
- **Decision not executed:** Network Index is **read-only by default**, scoped to a verified execution route/SIM family. Any later change requires independent evidence audit/confirmation; don't copy Sama network index into Arsselli or infer from View Index. No network-index edit added in this batch.

---

## 2026-10-17 — «الاتصالات والشبكات» administrative catalog (SOURCE ONLY)

**User direction:** \`amordz72/mytool-dev\` development is PAUSED. Continue actual product work in **Flexy Mini**. Shared canonical Supabase entities/RPCs remain readable dependencies, **not** authorization to edit MyTool Dev source or create parallel catalog tables. The previous draft documentation PR in MyTool Dev is not part of this Flexy Mini release.

- **[UI SOURCE]** \`src/TelecomCatalogAdmin.tsx\` + admin-only navigation in \`src/main.tsx\` add a read-only «الاتصالات والشبكات» page with two separate tabs: «كاتالوجات العروض» and «الأكواد التشغيلية». Filters: operator, offer family, execution-route SIM type, purpose (codes), and search. Offer table expands to show only its associated execution routes and distinct evidence source kinds; an offer without any route stays in the unfiltered catalog. Carrier family does not become a SIM type; Dima/Gold are not seeded or claimed executable.
- **[OWNERSHIP / NO REBUILD]** All catalog data is loaded via existing guarded admin RPCs: \`station_connect_admin_operators\`, \`station_connect_admin_sim_types\`, \`admin_flexy_list_offer_catalog\`, \`admin_flexy_offer_execution_routes\`, \`admin_flexy_offer_source_matrix\`, \`mytool_admin_ussd_codes_list\`. UI does not read \`private\` tables directly, duplicate cards/products, write to records, run USSD, create jobs or create financial orders. Code knowledge/implementation status is displayed independently of execution permission. \`route.enabled && verified\` does NOT claim a live connected SIM or financial readiness.
- **[PERMISSION]** Admin-only menu branch, customer menu remains services-only; RPCs enforce \`private.is_shop_admin()\` independently of the UI.
- **[VERIFICATION LEVEL]** Source implementation and isolated regression test; GitHub PR checks and installed Android phone acceptance are separate evidence gates. No migrations, no database data changes, no network/Agent or financial tests. The user must verify displayed page and filters on the deployed PWA after merge/release; until then mark \`IMPLEMENTED / USER_CONFIRM_REQUIRED\`.
- **[NEXT]** After mobile acceptance, decide whether editable service/family management is necessary or can be achieved through existing catalog/admin operations. Do not introduce arbitrary service catalogs or modify MyTool Dev while paused.

---

## 2026-10-16 — First successful silent Sama discovery recovery (VERIFIED)

At 16:30 UTC (17:30 Algeria), the active 15-minute Supabase cron initiated one nonfinancial `mobilis.offer.discovery` background job on `sama-3` / `server-2`. It completed at 16:30:32 UTC: job and discovery `success/DISCOVERY_COMPLETE`, recipient classified `PIXX`, five offers saved; one start, one reply, one release, session closed. No recipient number/PIN exposed in docs, zero background financial jobs, zero open or queued commands after. First idle-time recovery is **live-proven**. The code is tracked in [Station Connect PR #14](https://github.com/amordz72/station-connect/pull/14); Linux/Windows GitHub Actions run 38932351798 failed with no steps, so CI is NOT passed.

**Not to confuse:** early refresh of still-valid active recipients is a proposal only; conditional 3–5 second grace and SIM pool/rotation are NOT implemented. Cached Revolution/Sama/PixX can become stale if an offer/SIM changes; no validated financial-failure-triggered cache invalidation exists yet, and there is NO permission for blind financial retry. The independent Sama financial PIN fix PR #13 remains undeployed.

---

## 2026-10-16 — 30-day recipient classification and silent recovery (DB APPLIED)

**User rules:** a known recipient gets cached Sama/PixX/Revolution identity for 30d, without a new discovery session. A new/expired/incomplete recipient may require the Sama network. A failed/unknown or incomplete reply is NOT evidence of "no offers". Server may opportunistically retry previously incomplete discoveries on an idle physical Sama modem; it must not interrupt actual financial work or continuously refresh a valid identity. Periodic early refreshing of frequently used recipients was only a suggested idea and is disabled. Current SIM offer-family may change, so cached identity is last-known evidence only; definitively carrier-confirmed mismatch should trigger review/re-discovery, not blind financial retry.

**Applied:** Station Connect Supabase `station_discovery_identity_30d_hardware_guard_20261016` version `20261016161644` sets Mobilis TTL 720h and prevents concurrent active sessions per modem and simultaneous discoveries of same phone. `station_idle_discovery_recovery_function_20261016` version `20261016162729` plus separate cron `station_idle_discovery_recovery_schedule_20261016` version `20261016162810` adds every-15-minute idle checks. Privacy restricted to server scheduler, one failed network discovery recovery per tick with min 24h and max 2 background attempts per 30d. Dry-run successfully located an eligible target, but **no automatic USSD result had been verified** after activation. Read details from [Station Connect PR #14](https://github.com/amordz72/station-connect/pull/14). No wallet/PIN/Agent/financial order changed.

**Still pending:** conditional 3–5s after-discovery live-session grace, SIM pool rotation/priority waiting, definitive no-offers detection, financial network outcome/correct small Arsselli activated routes. PR #13 Sama profile PIN bug is draft/not deployed. No production customer financial readiness claim.

---

## 40. 2026-10-16 — Scoped platform expense register with audit

- **[SOURCE OWNERSHIP RECHECK]** The existing `money_operations` / `cash_place_operations` / `mytool_operations` belong to shared MyTool branches, accounts, cash places and reconciliations; there is no proven `Flexy Mini` platform expense record or scoped expenditure identity there. Never treat shared money movements as operating expenses for Flexy Mini. Historical `sales` and service orders remain excluded from this app's report to prevent fabricated margin or duplicated financial sources.
- **[PLATFORM-SCOPED REGISTRY]** `supabase/migrations/20261016171500_flexy_mini_operating_expenses.sql` creates one `public.flexy_mini_operating_expenses` table with `expense_date`, category, title, `amount`, optional note, actor+timestamp, `request_key` for retry idempotency, and audited `voided_at`/`voided_by`/`void_reason`. RLS enabled and no direct authenticated/anon table grants. Admin-only read/paginate, create, void RPCs check `auth.uid()` + `private.is_shop_admin()`. No direct delete or edit of booked expenses; reversing by void marks the row, history remains. No cash/money, wallet, orders, station jobs or payment action occurs.
- **[REPORT LINK]** Existing `FinancialReports.tsx` `الأرباح والمصاريف` includes `FinancialExpenses.tsx`, displaying the selected date range's total **of active manually recorded expenses** and paged list. Expenses are global to the platform for the selected date interval, **not filtered by telecom operator or order success state**, because those dimensions are for orders only. Category/subscription payments must be entered once by the admin when actually attributed to Flexy Mini; no automatic recurring charge, no screenshot-derived 29,000 DA seed, no backfill.
- **[NO FALSE NET]** Monthly profit remains **غير مكتمل** even if there are registered expenses; historical `flexy_orders` sales/profit fields are missing and games/IDOOM/customer settlement coverage incomplete. Existing `flexy_mini_admin_financial_report` remains read-only from `flexy_orders` only. CSV summary notes that expense totals are in their separate ledger and does not accidentally show `0` as unknown net. Does not silently move account balance or write any actual monetary movement.
- **[RELEASE]** Check guard rejection fixture + current framework compliance, regression tests including `tests/financial-expenses.test.mjs`, TypeScript and production build. Apply migration after passing CI, verify ACL, 0 initial rows and prior account/order counts untouched. Then merge to default branch and phone-check deployed report before claiming mobile behavior proven.

## 39. 2026-10-16 — Order detail drill-down and report export

- **[CONTEXT / SOURCE AUDIT]** User approved single Flexy Mini report (consumption/profits/expenses) but records needed verifying before combining. Read-only Supabase audit on Oct 16: 30 rows in shared `public.sales` are MyTool cross-project sales, not attributable to Flexy Mini by available keys; 6 `mytool_service_orders` are mostly draft/ready and financial posting `not_posted` even for its one `success`; `flexy_mini_customer_wallet_ledger` holds two opening entries only. `flexy_mini_card_codes` count 0. None are confirmed Flexy Mini customer settlements. **No join, UNION, backfill or profit attribution** to these tables is authorized. `flexy_orders` remains the sole report fact source for current phase.
- **[IMPLEMENTED READ-ONLY]** `supabase/migrations/20261016163000_flexy_mini_admin_financial_report_orders.sql`: `flexy_mini_admin_financial_report_orders` accepts the **same inclusive Algeria-local date/carrier/status** filters as existing summary, with bounded `limit` and `offset` (10 rows/page by UI). `STABLE SECURITY DEFINER` enforces `auth.uid()` + `private.is_shop_admin()`; anon revoked. Returns only `flexy_orders` snapshot fields, no phone, credentials, modem/USSD raw content. Profit/sale/rate fields are shown as saved, only for technically successful rows; NULL stays unknown, and assumed/inferred codes are visibly flagged. No accounting write or extra sources.
- **[REPORT UI]** `src/FinancialReportOrders.tsx` adds an admin-only **تفاصيل العمليات** tab to `src/FinancialReports.tsx`, compact 3-column mobile table and expandable historical details. Same applied filters, server-side pagination, short time and explicit disclosure of assumed/inferred results. The main report adds a month selector, **تصدير ملخص CSV** (ONLY selected aggregated summary + grouped rows; not the entire raw transaction history) with BOM, escaping, CSV formula-injection guard, and browser **طباعة**. Original **الاستهلاك** and **الأرباح والمصاريف** remain separate.
- **[UNAVAILABLE]** Game/cards/IDOOM real sale accounting and per-platform expense register remain unlinked: still no real total net profit calculation. No new expense table, backfilled margin, card inventory mutation or settlement semantics added.
- **[VERIFICATION]** mandatory Development Guard checks (including deliberate bad fixture), project's existing regression tests plus `tests/financial-report-details.test.mjs`, TS+build CI, DB permissions and September order detail readback. Actual PWA/mobile deployment and formatting remain to be visually verified.

## 38. 2026-10-16 — Read-only Flexy Mini admin finance report

- **[APPROVED]** User approved the format of consumption and profits/expenses reports from sample screenshots. Phase 1 is **read-only**, bounded to existing Flexy Mini orders only, and retains original snapshots; no new sales/expense tables, no duplicates or wallet/USSD side effects. Other business lines remain explicitly **not connected** until their authoritative transaction sources are verified.
- **[SOURCE / AUTH]** `public.flexy_orders` is canonical for past Flexy order events (not `station_connect_jobs` directly). New `public.flexy_mini_admin_financial_report(p_from,p_to,p_operator,p_status)` RPC is `STABLE SECURITY DEFINER` with `auth.uid()` and `private.is_shop_admin()` guards, anon revoked. Dates are **inclusive Algeria-local creation dates**, year-range bounded, server validates filter values. Aggregates by operator/service and status using only order snapshots. Never join with MyTool `sales`, customer wallet ledger or station job counts (would double count or imply accounting linkage that is not established).
- **[NO FALSE PROFITS]** `face_amount` is **nominal requested value**, not booked/collected sales. Only non-null persisted `sale_price` and `profit_amount` in `success` rows are eligible for those monetary totals; if **any selected success row** lacks a field, its complete aggregate is **NULL/unknown**, not 0 or a partial total presented as final. When no successful rows exist, revenue/profit also unknown. Success state may be `MOBILIS_FLEXY_SUCCESS_ASSUMED_HEALTHY_TIMEOUT` or `...INFERRED_BALANCE_DECREASE`, so report separately counts these as **inferred/assumed**, not independent network-confirmed settlement. No retroactive repricing from current customer rates.
- **[REPORT UX]** `src/FinancialReports.tsx` is a compact mobile Ant Design admin page routed through existing Refine shell `page=reports`, with Algeria-local From/To + carrier/status filters, month shortcut, refresh, tabs **الاستهلاك** and **الأرباح والمصاريف**. It displays verified source coverage and explicitly states **cards/games, IDOOM, expenses, net profit are not yet connected**. It does not fabricate expenses, success confirmation or historical profit. No write RPCs and no financial dispatch.
- **[LIVE EXPECTATION BEFORE APPLY]** Audit showed 9 `flexy_orders` September 2026, including 6 stored success states with all 6 `result_code` assumed/inferred and 3 failed; all 9 lack `sale_price` and `profit_amount`. September face total 430 DA, success face nominal 310 DA (NOT sales). `flexy_mini_credit_transactions` 0, `flexy_mini_card_codes` 0, shared `sales` 30 but not ownership-linked; never combine these in the first report.
- **[CHECKS]** Architectural Development Guard + deliberate bad fixture rejection, existing tests plus `tests/financial-reports.test.mjs`, TypeScript + production build, post-migration function-permission and month aggregate checks. Human Android/PWA test after GitHub Pages publish. No business-state mutations were authorized.

## 37. 2026-10-16 — Server-owned read-only card price/margin preview

- **[USER CONTINUATION / SCOPE]** After actual per-customer rates are saved, the next safe step is to **preview** the charge and direct margin for existing catalog card/game/IDOOM variants. Do NOT enable actual financial orders, USSD, wallet movements, discount-insertion in existing order pipeline, or automatic rate changes based on debt/source readiness.
- **[SERVER]** `supabase/migrations/20261016130000_flexy_mini_admin_card_price_preview.sql`: `flexy_mini_admin_card_price_preview(p_customer_id,p_variant_id)` reads the **specific saved customer rate** for `card:<product_id>`, existing `flexy_mini_variants.sale_price` and `.purchase_price`. It does **not** fall back to the default-rate template and does **not** infer 0% for an unset customer. Admin JWT + `private.is_shop_admin()` verified in RPC, function is STABLE/read-only; anon execution revoked. Computes `customer_charge = ROUND(sale_price × (1 − discount_percent/100),2)`; `margin_before_other_fees = customer_charge − purchase_price`. This is **not NET profit**: it excludes fees/overheads. If purchase price is zero/missing, sale price missing, customer rate unset, customer inactive, variant/product inactive/frozen, report blocked reason. Lack of stock reports `out_of_stock`, with quote math still possible for planning if pricing data complete. Response always `quote_only:true`, `financial_dispatch_enabled:false`, `can_sell:false`.
- **[UI]** In existing admin-only `نسب الزبائن` page, a `معاينة سعر البيع` tab reads catalog variants and calls read-only quote RPC on explicit click; no local input for source costs. With selected Mobilis normal/activated (not card products), explain that actual SIM route costs are missing/not priced and do not pretend the card formula is an actual USSD source quote. Existing `المحاكاة` stays untouched/RAM-only. Global footer now correctly distinguishes real rate management from demo.
- **[QUALITY]** `tests/customer-rate-quote.test.mjs` checks server authorization, absence of mutation/dispatch, exact rate match and lack of default fallback. GitHub Development Guard and CI required. No new accounts or fictitious defaults created to test this feature.
- **[NEXT]** For real Flexy 630/696/Sama offers, collect and verify *actual source purchase costs, direct fees and eligible same-service routes* before pricing comparisons. Preserve current server route/status and avoid billing customer on unknown dispatch.

## 36. 2026-10-16 — Admin customer discount rates; signup-only default snapshot

- **[USER DECISION]** Pricing groups A/B/C rejected. One admin-set discount per existing customer × product/service; 0% is a valid *explicit* discount, an absent rate is **unset**, not 0%. Default rate is a **new-account template only**. Existing customers are never modified when the default changes, regardless of whether they've been manually customized. Customer business role, debts, source costs, margin and station execution stay separate.
- **[SCHEMA]** Proposed `supabase/migrations/20261016123000_flexy_mini_customer_discount_rates.sql`: single admin-only `public.flexy_mini_discount_rates` table with nullable `customer_id` (null = default, non-null = customer-specific) and explicit service key; partial unique indexes and RLS with no direct browser/table grants. One AFTER INSERT trigger copies **existing** default rows when each account is created, in the same transaction. **No fake example rates seeded and NO existing customer backfill.** Protected read/set RPC checks `auth.uid()` + `private.is_shop_admin()`; atomic optional update for both Mobilis ordinary/activated.
- **[FRONTEND]** Reuses `src/FlexySimulationPage.tsx` with `production` prop for an admin-only **نسب الزبائن** route, keeping original **المحاكاة** fully RAM-isolated. Same compact category/service → customer/rate/edit UI. Live editor reads rates via admin RPC, shows **غير محددة** when missing, and requires explicit Save for default or customer rate changes; production hides the hypothetical profit calculator. No service key is inferred from SIM or distributor.
- **[SAFETY]** Existing customer Edge Function deployed version 19 differs from GitHub source in `wallet_post` idempotency. **Do NOT redeploy Edge Function as part of pricing**. The new functions/trigger handle new-account rate copying automatically regardless of signup path. The existing wallet, customer auth, Station and financial USSD code remain untouched. New pricing has **NO** actual order quote, customer discount in financial execution or automated loss cap routing until separately approved/tested.
- **[TEST PLAN]** Run Development Guard deliberate rejection + compliance, existing tests including `tests/customer-rates.test.mjs`, TS and production build. Apply migration only after reviewing CI, then confirm permissions, schema, 0 initial rates, blocked anon RPCs and live admin UI. Existing customers must not be assigned example percentages. Phone/PWA verification still pending.

## 35. 2026-10-16 — Compact mobile rate preview replacing wide comparison

- **[USER APPROVED / UI REFERENCE]** The Tehni Pay screenshots show a simple screen: product category -> subcategory -> list with customer, one rate and an edit button; edit modal has the user name, subcategory, percent, Apply/Cancel. User specifically wanted **no horizontal-scroll, multi-service comparison table** on phone and no new A/B/C rate groups.
- **[UI CHANGE]** `src/FlexySimulationPage.tsx` keeps the existing authenticated admin simulation but now displays **one chosen subservice** in a compact Ant Design customer table (username/rate/edit). There are category options for Flexy, IDOOM/internet, telecom cards, and games/digital cards; product names come from the current catalogue read. Where a category is empty, it shows an empty placeholder rather than fake entries. Customer filtering and 10-row pagination remain available.
- **[EDIT SAFETY]** The Ant Design modal has an editable draft percent. Cancel discards unsubmitted edits; Apply updates **only** the selected customer's simulation-only in-memory rate for that service. An explicit checkbox can apply the same rate to Mobilis ordinary and activated together. 0% is a valid rate. The default tab edits only an independent new-account template snapshot; existing simulation customer values are not changed by defaults.
- **[BOUNDARIES]** All pricing data and suggested purchase costs are **fabricated simulation examples**, never live source costs or actual registered customer discounts. Real account usernames are read from the existing admin-only customer listing. No new customer accounts, role assignments, price DB writes, customer wallet changes, USSD or network operations. Prior profit calculator preserved as a simulation tab. Return-to-main entry preserved.
- **[VERIFICATION TO FINISH]** GitHub PR guard (deliberate violation test and architecture policy), existing code tests, TypeScript + production build; after deployment verify phone UI and customer account list. No PWA verification claim until observed.

## 34. 2026-10-16 — Simulator filter controls inside rate-edit modal

- **[USER BUG REPORT]** The admin simulator rate editor opened without the carrier/product filter seen in reference UIs. The customer list also showed only action buttons rather than any visible rates for filtered services.
- **[SOURCE CHANGE]** `src/FlexySimulationPage.tsx`: shared operator/product-family (Mobilis/Djezzy/Ooredoo/card products) + searchable exact-service filter above tabs, **repeated inside the customer edit modal** so the filter is accessible while the modal is open. Customer table shows the selected service's simulated rate per existing account; search and active/disabled status filter display count. Default rates and rate-edit tables follow the same selected service filter. The selected customer and per-customer local rate snapshots remain intact through filtering.
- **[BOUNDARY]** Existing admin-only customer list and read-only product names remain the only queries; no role filter is invented (customer listing does not expose role), no production updates, no financial execution, no new customer accounts. Rates are still **fictional local simulation** until a separately approved backend.
- **[VERIFICATION]** Confirm Development Guard, deliberate fixture rejection, tests, TypeScript/build on PR, then visually verify modal filters and mobile-width table. No production financial claim.

## 33. 2026-10-16 — In-app customer discount simulator, no production rates

- **[USER-APPROVED]** Build a simple pricing simulator using the accounts **already** registered in Flexy Mini (no dummy customer creation), each account with independent discount snapshots per service/product; a new account inherits defaults once at signup **in future production implementation**, not live-linked to them. Business pricing, customer role/permissions, financial margin, and station route eligibility are different layers.
- **[SOURCE/UI]** New `src/FlexySimulationPage.tsx` uses the existing Ant Design/Refine dashboard layout, existing authenticated admin `flexy-mini-customers` `action:list` endpoint (display username/account status only) and read-only card-product names from `flexy_mini_products`. The old frozen `public/lab.html` remains untouched; the admin bottom nav now opens the **in-app** simulation rather than a separate tab, with a clear **العودة للموقع الرئيسي** button and reversible home action.
- **[SIMULATOR BEHAVIOR]** Rates for ordinary Mobilis, activated Mobilis, Djezzy, Ooredoo plus currently readable card products are local *examples* in component RAM, never actual customer rates. Editable default percentages do not retroactively modify existing simulated customer snapshots. User can edit an existing account's demo percentages, set both Mobilis types to 0% with one click, and try a margin computation by changing amount, cost discount, fee and source-ready flag.
- **[NO MONEY/NO WRITE]** No save API, Supabase migration, debit, order, Job, Station request, PIN or USSD; navigation to the page is admin only, and the shared Edge customer listing performs server-side admin authentication. This does **not** implement production signup rate copying or dynamic source-router pricing, nor does it read actual customer discounts.
- **[GATE]** Development Guard deliberately-invalid fixture rejection, approved UI check, existing tests, TypeScript and production build passed on PR #26 job `116914075487`; rerun after this docs commit. Mobile/PWA verification remains pending until Pages publishes.
- **[NEXT]** Open the admin account from the phone, enter 🧪 المحاكاة, confirm list of current users and round-trip button, then approve or correct the interface before any production discount tables are added.

## 32. 2026-10-16 — Arsselli distributor choice: SERVER selects, UI displays; priority editing admin only

- **[USER DECISION]** In Mobilis Arsselli, each distributor's balance lives on the server, and the server chooses an eligible distributor account automatically before `630` ordinary credit; the Windows Agent never selects a distributor. `630` requires distributor code between the recipient and amount. `696` remains a separate offers operation.
- **[DB APPLIED]** Station Connect [PR #11](https://github.com/amordz72/station-connect/pull/11) merged, migrations `20261016074334`, `20261016074344`, `20261016074351` applied. Canonical baseline by SIM and account, confirmed debits for same distributor, pending/review holds and configurable priority. `630` original admin preflight and review-only stage route through the server selector; 696 has read-only preview only, no live automatic fallback. The `630` stage stores selected account and SIM but never starts financial USSD.
- **[DB APPLIED / PERMISSIONS VERIFIED]** Station Connect [PR #12](https://github.com/amordz72/station-connect/pull/12), merged commit `6c49d80469fe79dce229d03ae42004a20efe4298`, migration `20261016075348` adds admin-only `station_connect_admin_arsselli_account_preferences` read RPC for all five accounts of one SIM. Existing admin setter already stores priority and enabled. Anonymous access blocked, admin read succeeds; no new financial records.
- **[UI IMPLEMENTED]** Flexy Mini [PR #25](https://github.com/amordz72/flexy-mini/pull/25) merged commit `c041ccbbfd6a5487498ae895a07693217b75e276`. `src/FlexyServicePage.tsx` removes stale `03` manual distributor selector, displays server-selected account and masked 630 command only after successful preflight, invalidates previous selection on phone/amount change, and reports actual stage-selected distributor. No customer money transfer.
- **[UI IMPLEMENTED]** `src/ArsselliAccountPriorities.tsx` expands inside existing `ArsselliBalanceActions` in Station details: view per-account usable/pending holds, set priority/enabled via admin RPC. Uses existing Refine + Ant Design UI; no parallel account balance table or device-side rules.
- **[CI VERIFIED]** Flexy Mini Development Guard [run 38870035111](https://github.com/amordz72/flexy-mini/actions/runs/38870035111) successful: deliberate guard violation rejection, guard check, behavior tests, TypeScript and production build. Station Connect Agent Check still fails **before steps initialized**, so do not claim its source tests passed.
- **[OUTSTANDING]** Confirm main GitHub Pages deployment / installed Android PWA latest build and manually inspect the account choice from a signed-in admin phone. Per-transaction atomic money reservations and live 630/696 financial switch remain unimplemented. Never treat a `review` staged job or preflight as a successful send.

# Flexy Mini — خريطة سلوك النظام ومصادر الحقيقة

**الحالة:** CURRENT WORKING MAP / فحص عبر المستودعات والكود وقراءة قاعدة البيانات فقط  
**التاريخ:** 2026-10-13  
**المالك التنفيذي لواجهة هذا المنتج:** `amordz72/flexy-mini`  
**المرجع المركزي بين المشاريع:** `amordz72/developer`  
**سياسة مجال Flexy الأحدث:** `amordz72/mytool-dev/flexy/policy/CURRENT-POLICY.md` مع `SOURCES.md`  
**هذا الملف وثيقة فهم وسلوك، وليس إذنًا بإرسال USSD أو شحن أو تعديل الأرصدة.**

> **اقرأ هذا الملف قبل أي تعديل Flexy**، ثم افحص الملف البرمجي الحقيقي في المستودع المعني والحالة الحية إذا لزم الأمر. لا تبدأ من الصفر. لا تستنتج أن خاصية جاهزة للإنتاج لمجرد وجود وظيفة SQL أو React أو سجل نجاح قديم.

## 31. 2026-10-15 — Account-specific card visibility grants / backend v19

- **USER DECISION:** An administrator may allow one customer account to see an otherwise hidden product or variant. This is a separate customer-account permission, NOT the general catalogue eye toggle. Neither the visibility exception nor un-hiding overrides the independent `is_frozen` stop or an inactive category, product or variant. This work does NOT enable card buying.
- **OWNER / SOURCE:** `amordz72/flexy-mini` PR [#23](https://github.com/amordz72/flexy-mini/pull/23), merged into `main` as `27a768fce0df0a4d6a6982dd8501f48c38bfe1b0`. Existing customer management UI (`src/main.tsx`) shows the admin-only `بطاقاته` modal; it lists hidden products/variants and displays the independent frozen/disabled state using Ant Design.
- **DB:** Migration `flexy_mini_customer_catalog_grants_20261015` **APPLIED**. Private `public.flexy_mini_customer_catalog_grants` holds one customer-specific permission per product or variant, backed by valid foreign keys and partial unique indexes; RLS is enabled and direct SELECT privilege for `anon` and `authenticated` is revoked. `service_role` has the minimum read/add/remove privileges. **No grants inserted automatically**; readback reported **0 existing exceptions**.
- **SERVER:** `flexy-mini-customers` Edge Function version **19 ACTIVE**, deployed by patching the previous live version 18, without altering its wallet-posting behavior. `catalog_access` and `catalog_grant` require Supabase-authenticated admin permission. Customer `catalog` still checks active session, approved unrevoked device, matching device-secret hash, and active account; customer identity is derived from session, never a supplied customer ID. A grant to a hidden product exposes only its generally visible variants; a specific variant grant also exposes the hidden parent to this customer but not other hidden variants. Parent and child must both remain active+unfrozen. Only presentation identifiers, names, denominations, order and stock quantities are returned, not card codes, purchase cost or financial state.
- **VERIFICATION:** PR Development Guard, project tests, additional mocked admin/customer permission regressions, TypeScript and build **PASS** in workflow `38817431480`. After deployment, verified `Edge v19 ACTIVE`, table RLS and role privileges, all action branches and frontend management dialog in GitHub. There is **no authenticated production customer/admin acceptance yet**; this does not imply any completed purchase. At the snapshot, 2 hidden products and 4 hidden variants existed; no exceptions had been granted.
- **CRITICAL SOURCE/LIVE FINANCE DRIFT STILL EXISTS:** GitHub Edge source uses `flexy_mini_wallet_post_once` while production deliberately retains earlier `flexy_mini_wallet_post`. Targeted deployment preserved the existing live behavior. Do not overwrite the deployed Edge Function wholesale on the next change without a separately reviewed wallet release.
- **NEXT VERIFIABLE STEP:** On the new deployed phone build, open existing customer administration → one selected account → `بطاقاته`; grant/revoke a harmless hidden item, verify only that approved customer sees it and no frozen item is exposed. Restore the original grant setting after the test; no actual purchase or stock mutation. Confirm the build SHA separately from GitHub source and DB.

## 30. 2026-10-15 — Customer card catalog: authenticated, filtered, deployed

- **USER DECISION:** Complete `catalog` for customer logins before enabling card purchasing. The same existing Refine/Ant Design Cards catalog is reused; no new customer UI, financial sending, wallet posting or stock mutation.
- **SOURCE:** `src/main.tsx` passes the current stored customer token **and the existing device secret**; `supabase/functions/flexy-mini-customers/index.ts` handles `action:"catalog"` under the same checks as `me`: unrevoked and unexpired hashed-token session, session-linked approved unrevoked unexpired device, matching secret hash and active customer account.
- **SERVER RESPONSE:** Only active categories; products and variants must each be `active=true`, `display_mode='visible'`, and `is_frozen=false`. Variants are returned only when their product and category also qualify. Order by `sort_index` with existing numeric tie-breakers. No purchase prices, PINs, voucher codes, customer wallet data or write action in catalog.
- **ACCOUNT-SPECIFIC EXCEPTIONS:** Not implemented; hidden items fail closed for all ordinary customer accounts until an explicit account-level policy with server-side authorization exists. Existing admin preview is distinct from this approved-device endpoint.
- **SOURCE/TEST:** GitHub PR [#21](https://github.com/amordz72/flexy-mini/pull/21) merged to `main` at `e54e53dcf331de9eb715318826a801534152c105`; CI Development Guard, existing tests, new mocked customer-catalog security/visibility tests, TypeScript and build **PASS** (PR workflow run `38815845024`). Tests verify denied missing/expired/revoked sessions, wrong device secret, unapproved/revoked device, inactive account, and parent/child filtering.
- **BACKEND:** Supabase `flexy-mini-customers` **version 18 ACTIVE**, source readback checked after deployment. This was a **targeted patch of the live version 17** to preserve all pre-existing wallet operations. No SQL migration, card price, inventory, account or station change. Production read-only filter comparison: **4 active categories, 5 eligible products, 25 eligible variants** at verification time; counts may naturally change.
- **CRITICAL SOURCE/DEPLOY DIFFERENCE:** The GitHub Edge Function contains a not-yet-deployed change to wallet posting (`flexy_mini_wallet_post_once` with `request_id`), while the deployed production v18 intentionally retains `flexy_mini_wallet_post` from v17. **Never deploy the GitHub function wholesale without a separate reviewed wallet compatibility/idempotency check.** Preserve the live version's financial behavior unless a later explicitly reviewed deployment supersedes it.
- **NOT PROVEN:** Real approved customer device/PWA acceptance and Pages deployment SHA; frontend commit on `main` is not by itself proof that a customer handset fetched the new JS. Card buying stays disabled, with no backend purchase authorization/settlement yet. Do not treat SQL counts or simulated tests as customer purchase acceptance.
- **NEXT ONE STEP:** Verify the installed phone's latest Pages build SHA, log in with an authorized test customer/device, open Cards and confirm 5 visible products/filtered variants (counts may change), then test revoked-device denial without touching money/stock. Account-specific visibility rules and card checkout remain separate future work.

## 21. 2026-10-13 — PIN saving must NEVER force SAMA; 0660 is only an option hint

- **[USER SCREENSHOT + DB-VERIFIED]** The second Mobilis SIM on the test Station became `mobilis-sama` after the legacy “تجهيز Mobilis Sama” form saved its PIN. Database confirms PIN saved, but physical SIM type was wrongly changed; user identified this SIM as **Arsselli**.
- **[ROOT CAUSE / CODE]** Existing `StationOverview.tsx` combined `p_service_pin` with `p_sim_type:'mobilis-sama'` in a single call. This was a UI coupling bug. PIN and SIM type are independent identities, and an edit to one must not silently change the other.
- **[FIX IN REVIEW BRANCH]** Replace Sama-specific PIN editor with Ant Design PIN modal for the selected SIM. Save through existing `station_connect_admin_update_sim` using only `p_sim_uuid` and `p_service_pin`, preserving existing type/phone/approval. Keep the independent type dropdown Save action. No USSD or financial operation.
- **[OWNER SUGGESTION]** For verified Mobilis numbers starting with `0660`, the frontend may show a **nonbinding Arsselli suggestion** with a one-click draft selection; owner must still confirm/save type. The prefix does **not** establish whether the SIM is Sama/Arsselli, so must not automatically reclassify other SIMs by MSISDN prefix or use it as an execution route.
- **[CURRENT DATA]** A real SIM was saved with the wrong SAMA type; owner must correct to Arsselli via an authorized admin UI action. **Do not silently apply one-off SQL correction**, do not reveal/store PIN or real SIM phone numbers in this documentation.
- **[VERIFICATION]** `flexy-mini` PR #3 branch `feature/station-sim-type-selector-20261013`, source commit `4341a0647`. CI/deployed Pages/PWA outcomes to check. Live classification not corrected by the source commit alone.

## 20. 2026-10-13 — SIM Type selector: simple UI first; extra mismatch protection deferred

- **[USER-APPROVED]** Use the existing Stations/SIMs table to choose the managed SIM type directly. Minimal effective options: Mobilis SAMA and Arsselli; one standard Djezzy Flexy type; one standard Ooredoo Flexy type. Gross variants remain in the canonical registry but are not offered in this simple first selector; no schema/catalog duplication.
- **[USER-APPROVED / DEFER]** Owner explicitly postponed new server operator/type mismatch protection. Existing admin authorization and `station_connect_admin_update_sim` validation remain untouched. Do not claim deferred protections implemented or silently add new database constraints. Revisit before expansion to new operators, customer self-service or financial route automation.
- **[UI IMPLEMENTED IN REVIEW BRANCH]** `src/StationOverview.tsx` reuses Ant Design `Select` and `Button` directly within the current desktop Table/mobile Descriptions. The enabled type list is read from `station_connect_admin_sim_types()`, filtered by detected operator, excluding only `-gros` variants for Djezzy/Ooredoo. Save is explicit via existing `station_connect_admin_update_sim`, passing only SIM ID and type. Existing independent Sama PIN setup is preserved; type-selection itself does not change PIN, approve SIM, dispatch USSD or create financial work.
- **[USER-REPORTED]** The previously unknown second Mobilis SIM on new station is Arsselli. This fact is not a user instruction to mutate its record automatically; the admin will choose/save from the new interface once published.
- **[PENDING]** PR CI, published GitHub Pages version and physical browser/PWA test. No live database rows changed through this implementation.

## 18. 2026-10-13 — واجهة Sama القابلة للفتح وإلغاء فرض مبلغ 500

- **[USER-APPROVED]** Sama تُعرض داخل صندوق قابل للفتح فقط، وفيه Mix/Talk/Net؛ PixX وRevolution في صفوف كاملة الاسم والسعر مثل MyTool؛ لا تكرر بطاقات الفئات أو حاويات الشرح. كود الواجهة: `2734383`.
- **[USER-APPROVED]** لا نفرض Arsselli على العروض الأقل من 500، ويمكن تنفيذها بـSama عندما مسار العرض المعين Verified/Enabled والشريحة والرصيد والخادم جاهزون. لا نُخفي أي عرض فعّال تسمح سياسة دور المستخدم بعرضه فقط لأن Sama غير موجودة. كود إزالة فلتر الواجهة: `2734383`.
- **[USER-APPROVED / COMMERCIAL]** عند غياب Sama قبل الـdispatch نعرض نفس العرض، ونجرب فقط Route Arsselli موثوقًا لنفس العرض، ونقدم للزبون خصمًا أقل وفق تكلفة المصدر/هامش الربح مع **عرض الخصم النهائي قبل التأكيد**. لا تثبيت 3% أو أي نسبة مفترضة ولا تغيير خصم بعد الموافقة. التنفيذ البديل والـquote غير جاهزين.
- **[SOURCE]** تغييرات UI: `src/FlexyServicePage.tsx`; اختبارات جديدة `tests/flexy-recipient.test.mjs`; Migration مصدر `supabase/migrations/20261013165000_flexy_mini_verified_sub500_offers.sql`.
- **[DB-READ-ONLY]** RPC `flexy_mini_admin_create_verified_offer_execute` في الإنتاج لا تزال تحوي `c.amount>=500`. **Migration لم تُطبَّق**؛ رفضت أداة التطبيق الاستدعاء. 18 Sama routes verified/enabled و7 Arsselli offer routes draft/disabled. لا تتجاوز الحارس المالي وتدعي نجاح المسار.
- **[TEST/DEPLOY]** الاختبارات أُضيفت لكن لم تتأكد نتيجة GitHub Actions بعد؛ لم يُتحقق من التطبيق المثبت على الهاتف؛ لم يُرسل USSD أو شحن؛ لا تغيير ببيانات Master/الأرصدة المشتركة.
- مرجع التفصيل وخطوات القبول: `docs/SAMA-CATALOG-AND-SOURCE-DISCOUNT-2026-10-13.md`. سياسة المجال الأعلى: `mytool-dev/flexy/policy/CURRENT-POLICY.md` (تصحيح 13-أكتوبر).
- **NEXT:** افحص CI/Pages ثم اعرض رقم الإصدار في الهاتف؛ طبّق واختبر migration server الضيقة عندما تتاح أداة آمنة، ثم جهّز quote تجاري موثق وRoute Arsselli لنفس العرض قبل أي شحن بديل.

## 0. كيف نستعمل الخريطة ولا نضيع مرة أخرى؟

- **[USER-APPROVED]** قرار صريح أكدّه صاحب المشروع، وهو المطلوب حتى لو التنفيذ ناقص.
- **[CODE-VERIFIED]** موجود فعلًا في Source أو SQL الذي تمت قراءته؛ لا يعني اختباره على الجهاز.
- **[DB-OBSERVED]** وجدناه في Supabase أثناء الفحص بتاريخ هذا الملف؛ لقطة تتغير، وليست إثبات اتصال دائم.
- **[HISTORICAL-TEST]** تجربة أو سجل قديم، لا ننقله تلقائيًا إلى حكم على النسخة الحالية.
- **[PENDING]** نقص مثبت أو عمل يحتاج اختبارًا، لا نسمّيه نجاحًا.
- **[SUPERSEDED]** قرار سابق استُبدل بالأحدث، يُحفظ للتاريخ ولا يُنفّذ تلقائيًا.

**ترتيب فضّ التعارض:** تأكيد المستخدم الأحدث + الدليل الحي الأحدث → سياسة `mytool-dev/flexy/policy/CURRENT-POLICY.md` المنطبقة على المجال → كود/Schema الإنتاج بعد التحقق → وثائق Developer المتخصصة → التجارب والمشاريع القديمة. لا يُعامل قرار Tehna 2026-08-23 على أنه يلغي تحديثات 2026-09-21/28.

## 1. لماذا نبني Flexy Mini؟

الهدف [USER-APPROVED]: منصة فليكسي عملية تقلل الاعتماد على تطبيقات خارجية منخفضة الهامش. المطلوب **بيع/تنفيذ فليكسي فعلي** لا مجرد صفحة جميلة أو مختبر اكتشاف.

- **الشاشة المشتركة نفسها** لمدير المحل والعامل/الزبون، مع إمكانات وصلاحيات مختلفة؛ ممنوع إنشاء واجهتين متنافستين للأدوار.
- شاشة «فليكسي»: رقم المستفيد → «عروض / رصيد عادي» → معرفة المجموعة المتاحة → اختيار العرض/المبلغ → توضيح المصدر والرسوم → تأكيد → متابعة الحالة والنتيجة. العميل لا يشاهد أدوات إدارة المحطة.
- شاشة «المحطات والشرائح»: الاعتماد، الهوية، المودم، SIM، PIN المحفوظ، الجاهزية، التشخيص والرصيد؛ **لا تتحول إلى صفحة بيع أو صفحة استكشاف عروض منفصلة**.
- اكتشاف عروض رقم الزبون عملية مساعدة **داخل مسار الفليكسي**؛ التاريخ الإداري قابل للطي، ولا يرسل استعلام عند فتح الصفحة.
- **الـAgent لا يحدد الأسعار أو الربح أو مجموعة العروض أو اختيار مصدر التنفيذ.**

## 2. المستودعات — من يملك ماذا؟

| المستودع | مصدر الحقيقة/المسؤولية | ممنوع الخلط |
|---|---|---|
| `amordz72/flexy-mini` | Refine + React + Vite + Ant Design + PWA، شاشة البيع الحالية، استدعاء RPC، تجربة الإدارة والزبون | لا يملك دفتر الأرصدة أو كود المودم أو SIM مستقلة عن المصدر المركزي |
| `amordz72/mytool-dev` | سياسة Flexy الحالية، كتالوج/مصادر/Routes/Profiles وسياسات الرصيد ومigrations مشتركة | لا نكرر جداول Master أو المال في Flexy Mini |
| `amordz72/station-connect` | Agent Windows Node، هوية المحطة، heartbeat، مودمات، jobs/sessions/commands، Gateway، إرجاع رد الشبكة | لا يُوضع تسعير أو تحليل تجاري متين داخل Agent |
| `amordz72/station-services` | خدمات عامة قابلة لإعادة الاستخدام: Huawei HiLink، Remote NDIS، USB، IP watcher، SMS، diagnostics | ليس سيرفر أعمال الفليكسي؛ hilink-modem 0.2.0 لم يُثبت نهائيًا على Windows الحقيقي |
| `amordz72/developer` | الوثائق والسياسات السابقة ودروس الأخطاء وخطوة العمل التالية | ليس المستودع التنفيذي ولا مخزن أسرار |
| `amordz72/tehna-connect-core` و`tehnapay-connect` | مراجع بحث وتجارب Discovery / Laravel / عروض وقدرات سابقة | **REFERENCE ONLY**؛ لا نعتمد قرارات قديمة خالفت سياسة MyTool الحالية أو ننقل التنفيذ آليًا |

**المصدر المركزي الحالي للبيانات:** مشروع Supabase مشترك، لا قاعدة موازية جديدة داخل Flexy Mini. `Station Connect` ينفذ من خلال Server Adapter/DB، ولا يتطلب وجود Laravel لإكمال المنتج الحالي.

## 3. الطبقات الثابتة التي لا تُخلط

`Operator → Offer identity → Knowledge/Discovery → Presentation group → Execution route → Execution profile → Routing policy → Physical SIM / distributor account → Readiness → Execution decision → Job/Session/Command → Result → Operational balance → Reconciliation/Alert/Recharge`

| المفهوم | معناه |
|---|---|
| المشغل | Mobilis / Djezzy / Ooredoo |
| هوية العرض | **operator + family + amount**؛ لا يدخل فيها رقم Index أو نوع الشريحة أو المودم |
| Family | PixX، Revolution، Sama Mix، Sama Talk، Sama Net... |
| Presentation Group | PIXX / REVOLUTION / SAMA؛ مجموعات ظهور حسب ما أثبته استكشاف المستفيد |
| Catalog | بيانات العرض المعروفة والمبالغ والمسارات؛ لا يعاد بناؤها عند كل عملية |
| Source / Route | كيف يمكن تنفيذ عرض معلوم؛ قد توجد بدائل Sama/Arsselli لاحقًا |
| Profile | خطوات وقالب USSD وقواعد الأدلة؛ Schema/قراءة إدارة موجودة تاريخيًا، والمحرك الحي المبني على Profiles **غير مثبت كمسار كامل** |
| Physical SIM | ICCID/IMSI ونوع الشريحة وحالتها ومحطتها ورصيدها؛ ليست هوية العرض |
| Station/Modem | منفذ Hardware متغير؛ IP/USB ليس هوية دائمة للشريحة |
| Balance | رصيد تشغيلي لكل SIM أو حساب موزع، لا مجموع عام دون مصدر |
| Card stock | مخزون تجهيز/تعبئة الشرائح، منفصل عن عروض البيع للعملاء |

**[SUPERSEDED]** هوية `SimType + Family + Amount` القديمة و«Sama المصدر الوحيد ولا fallback» القديم.  
**[CURRENT]** إمكانية مصادر متعددة وترتيب ديناميكي عندما تكون Routes معتمدة؛ **[CURRENT PHYSICAL PILOT]** التركيز في الاختبارات الحالية على Mobilis Sama فقط، دون الادعاء أن كل المصادر متصلة.

## 4. الرحلة الصحيحة من أول تشغيل حتى إتمام عرض

### F0 — هوية وصلاحيات
1. المستخدم يدخل بواسطة النظام الحالي؛ جهاز الزبون الموثوق يحتاج اعتمادًا حسب صلاحياته.
2. الخادم يميز المدير/العامل/الزبون؛ أفعال المال/إدارة الشرائح لا تكفي فيها إخفاء الأزرار.
3. [CODE-VERIFIED] عمليات استكشاف/تنفيذ الإدارة الحالية RPCs خلف `private.is_shop_admin()`. [PENDING] لا توجد قناة مكتملة مصادق عليها لتمكين الزبون من discovery/send المالي بنفس الطريقة؛ **لا تُفتح RPC إدارية للعميل/anon**.

### F1 — تجهيز المحطة والشريحة تلقائيًا حيثما أمكن
1. Station Agent يفتح اتصالًا **Outbound HTTPS**، enroll/approved، heartbeat، اكتشاف المودمات/الشرائح.
2. نربط SIM بهوية مستقرة **ICCID/IMSI**؛ رقم هاتف الشريحة يُقرأ إن تيسر أو يؤكد إداريًا، وليس رقم العميل المستفيد.
3. تتحقق المنصة من SIM type الحقيقي: `mobilis-sama` أو `mobilis-arsselli`... وليس من ظهور مودم قديم فقط.
4. خدمة PIN الخاصة بالشريحة تُخزن في Secret/Vault؛ لا توضع في كود الواجهة أو الوثائق أو logs.
5. **الاعتماد الأمني للشريحة إجراء إدارة صريح عند التجهيز الأول**؛ لا تخلطه مع قراءة الرصيد اليومية.
6. تُعرض أسباب عدم الجاهزية بدقة: station heartbeat، modem، SIM، operator، sim_type، PIN، approval، baseline/balance، route.
7. [CODE-VERIFIED] `src/StationOverview.tsx` يجهز Sama، `src/SamaOperationalActions.tsx` يعرض الجاهزية والإذن/الفحص اليدوي؛ ``flexy_mini_admin_sama_readiness()` في DB تقرأ الحالة.
8. [PENDING] جعل **القراءة الأولى للرصيد آلية بعد اعتماد الشريحة** بدل شرط أن يضغط المستخدم على زر قراءة يدوي؛ الزر القديم يبقى fallback وتشخيص.

### F2 — المستفيد واكتشاف مجموعته
1. تطبيع رقم الزبون: إزالة الفراغات والفواصل، +213/213 تتحول إلى 0، الاتجاه LTR؛ تحقق رقم جزائري 10 أرقام.
2. افحص آخر Discovery **موثوق وصالح لنفس رقم المستفيد**؛ TTL ديناميكي. لا تستخدم نتيجة مستفيد آخر.
3. إذا كان صالحًا، استعمل Group من `station_connect_offer_discoveries` دون إرسال USSD.
4. **[USER-APPROVED / CODE 2026-10-13]** الضغط على «عروض» إجراء واحد: يقرأ Cache لنفس الرقم أولًا، ثم إن غابت نتيجة موثوقة وصالحة وكانت Sama جاهزة ولا توجد جلسة جارية أو غير مؤكدة، يبدأ **استعلام USSD واحدًا تلقائيًا** عبر Station Connect، بلا زر «استكشاف العروض» ولا «تأكيد الاستعلام» إضافيين. فتح الصفحة أو الكتابة وحدهما لا يبدأ USSD. تأكيد الشحن المالي مستقل وإلزامي.
5. Session USSD [مرجع تجارب Sama]: `*665*1*{phone}#` → طلب PIN الخدمة للشريحة حين تطلبه الشبكة → قراءة القوائم → 0/00 للتنقل فقط → raw responses محفوظة. لا اختيار عرض/تأكيد شحن أثناء الاكتشاف.
6. رد الشبكة يحدد SAMA (Mix/Talk/Net)، PIXX أو REVOLUTION؛ قد يكون الحقل العلوي `family` فارغًا لكن عناصر القائمة تكفي لتحديد مجموعة واحدة. الرد المتناقض = UNKNOWN.
7. الحالات: CLASSIFIED / IN_PROGRESS / NEEDS_DISCOVERY / UNKNOWN / NETWORK_ERROR؛ **خطأ أو فراغ لا يعني عدم وجود عروض**.
8. [CODE-VERIFIED] `src/CustomerOfferIdentity.tsx` + RPC `flexy_mini_admin_customer_offer_identity` و`station_connect_admin_create_offer_discovery`؛ المدة الافتراضية الحالية **168 ساعة/7 أيام قابلة للتعديل**. لا نعيد اكتشاف كتالوج العرض الكامل لكل عملية.

### F3 — عرض الكتالوج وتحديد الخدمة
1. اقرأ `flexy_offer_catalog` عبر `flexy_get_visible_offer_catalog_v2` وفق role policy.
2. بعد تحقق مجموعة المستفيد، اعرض عروض المجموعة وحدها؛ لا تجمع PixX وRevolution وSama قبل التصنيف.
3. الظهور **لا يساوي الجاهزية للتنفيذ**؛ إن غابت SIM لا نحذف العرض من Catalog، بل نوضح حالة التنفيذ.
4. Network Index والـExecution Profile مملوكان للمسار المعتمد؛ الإدخال اليدوي يطابق Catalog موثوقًا، لا يسمح بكود USSD مفتوح.
5. سياسة الكتالوج تشمل قوائم 50/100... تاريخيًا، لكن Flexy Mini الحالي يخفي ما دون **500 دج** [CODE-VERIFIED]؛ هذا **فلتر واجهة/مرحلة** وليس دليلًا أن الشبكة لا تعرض 50/100. قرارات الإظهار حسب الدور ومستوى الأمان مستقلة.
6. «رصيد عادي» مستقل عن «عروض»؛ لا تُرسل Sama كرصيد Arsselli بالخطأ. الشاشة الحالية تعرض خيار الرصيد لكن التنفيذ معطل حتى Route مثبت.

### F4 — التحضير والإرسال المالي الآمن
1. تأكد: رقم مستفيد صحيح + Discovery ما زال موثوقًا + عرض من مجموعته + Route مسموح + Source واقعي + رصيد تشغيلي كافٍ.
2. السياسة الأحدث يمكنها ترتيب عدة Routes حسب enabled/verified/priority والرصيد؛ **مسار Flexy Mini الحالي موجّه عمليًا إلى Sama** ولم يثبت تطبيق Router متعدد المصادر داخل هذه الشاشة.
3. تأكيد المستخدم النهائي وحده يرسل Job مالي. لا USSD تلقائي بمجرد اختيار العرض.
4. [CODE-VERIFIED] `src/FlexyServicePage.tsx` يرسل `flexy_mini_admin_create_verified_offer_execute` الذي يربط رقم الزبون بنتيجة Discovery المعتمدة والعرض داخل الخادم، ثم يفوّض `station_connect_admin_create_offer_execute_v2`.
5. رقم Idempotency خاص بنيّة الطلب نفسها ويظل محفوظًا عبر تحديث PWA؛ لا يعاد إرسال عملية معلقة بمفتاح جديد، ونتيجة UNKNOWN/REVIEW ليست نجاحًا/فشلًا محسومًا.
6. الخادم يجهز Job → Session → Commands (`ussd_start`/`ussd_reply`/`ussd_release`) وينتظر رد الشبكة؛ Agent يرجع raw response ولا يصنف نجاحًا ماليًا من مجرد ACK.
7. النجاح = رد أو دليل مؤكد، الفشل = رد مؤكد، الغموض = REVIEW وتحقيق لا إعادة مالية آلية.
8. [PENDING] تدقيق ربط `station_connect_begin_command_session` بهوية SIM/جلسة حديثة عبر تبديل المودمات، واختبار end-to-end على النسخة الحالية قبل توسيع الشحن.

### F4a — سياسة اختيار مصدر عروض Mobilis (قرار 2026-10-13)

**[USER-APPROVED / الأكثر حداثة]:** القرار البسيط عند إرسال عرض مُفعّل هو **Sama أولًا، وإذا لا توجد Sama متاحة مؤهلة لهذا العرض → Arsselli تلقائيًا**، بدون جعل الزبون يختار الشريحة. اختيار المصدر يتم في **Server Router قبل إرسال USSD مالي**، وليس بعد فشل طلب بدأت الشبكة تنفيذه.

- «Sama غير موجودة» تشمل غياب/عدم اتصال الشريحة، عدم موافقة الإدارة، غياب PIN أو رصيد تشغيلي كافٍ، أو Route غير verified/enabled. لا يعتبر ضعف إشارة الشبكة وحده فشلًا مسبقًا؛ نحاول عملية واحدة عندما شروط الأمان والمصدر مستوفاة.
- فحص البديل يتطلب Route Arsselli منفصلًا **لنفس العرض** verified+enabled وشريحة فعلية معتمدة ورصيد حساب موزع كافٍ. **لا تغيّر خدمة PixX/Revolution/Mix إلى شحن رصيد عادي صامت.**
- إذا لا يوجد مصدر صالح **قبل dispatch**: لا يوجد Job مالي، ونظهر **«الخدمة غير متاحة حاليًا، يرجى المحاولة بعد حين»**.
- إذا حصل خطأ شبكة **مؤكد أنه لم يُنفذ ماليًا**: **«يرجى المحاولة بعد حين»**. أما Timeout/رد غامض بعد بدء الإرسال فيصبح REVIEW **«طلبك قيد التحقق، لا تعاود الإرسال الآن»**، بلا Retry أو تغيير SIM تلقائي؛ منع ازدواج الشحن أساسي حتى عند ضعف الشبكة.
- حفظ قرار Route والـJob/Idempotency ومصدر الرصيد لكل طلب. Sama: مبلغ العرض + 10 دج عند النجاح المؤكد. Arsselli: المبلغ من حساب الموزع المختار. لا تستخدم Index Sama مع Arsselli.
- التبديل لا يغيّر مجموعات العروض المرئية للعميل؛ Presentation/Discovery مستقلة عن Routing.

**[CODE-VERIFIED 2026-10-13]**: `public.station_connect_admin_offer_route_preview` في Supabase يرتب المسارات الموثوقة والمفعلة حسب `priority` والرصيد؛ سياسة Core تسمح fallback. لكن `FlexyServicePage.tsx` ما زال يعمل بإرسال Sama-only إلى `flexy_mini_admin_create_verified_offer_execute`. مسارات Arsselli للعروض في الإنتاج `draft/disabled` (مثل PixX)، وخدمة `station_connect_admin_create_arsselli_flexy_696_v2` هي تنفيذ رصيد عادي بالمبلغ، لا تحويل عروض مثبت. **القرار مُسجَّل، والتنفيذ التلقائي المالي إلى Arsselli لم يُفعّل ولم يُختبر**؛ لا نتجاوز اعتماد Route أو نغيّر جدول الإنتاج لمجرد الوثيقة. السياسة المرجعية: `mytool-dev/flexy/policy/CURRENT-POLICY.md` (قسم Routing Policy المحدث).

### F5 — متابعة النتيجة والعمل اليومي
1. تظهر الحالة queued/claimed/success/failed/review، Job ID، وقت الطلب، النتيجة، والمصدر.
2. لا تكرار مالي عند انقطاع شبكة المستخدم أو إعادة تشغيل PWA.
3. تُسجل عملية العميل/الحساب/الـSIM المسؤولة في طبقة الأعمال/الدفتر المناسبة؛ واجهة Flexy Mini ليست Ledger جديدًا.
4. [PENDING] تمكين زبائن Flexy Mini من الإرسال مع تحقق المحفظة والحدود والحجز والصلاحيات من الخادم، واختبار آخر حالة وواجهة الجوال بعد النشر.

## 5. الرصيد التلقائي — قرار ملزم لا زر يدوي كل مرة

**[USER-APPROVED، مُعاد تأكيده 2026-10-13]** هذه السياسة كانت موثقة منذ 2026-09-22. مصدرها الأصلي:
- `amordz72/developer/projects/flexy/BALANCE-DISCOVERY-CUMULATIVE-RECONCILIATION-POLICY-2026-09-22.md`
- `amordz72/developer/guidelines/operational-balance-inventory-and-reconciliation.md`
- `amordz72/mytool-dev/supabase/migrations/20260922211500_flexy_cumulative_balance_router_v1.sql`

### دورة الرصيد لكل SIM/Account
`SIM online & approved → إذا لا يوجد Baseline، اطلب أول Balance Lookup من الخلفية مرة واحدة → احفظ الرصيد الحقيقي → احسب Expected من العمليات المؤكدة → فحص Router/Low threshold → Reconciliation وفق سبب فعلي → سجل الفرق + Snapshot جديد`

المعادلة:
`expected = last_successful_network_baseline + confirmed_inflows_since_baseline − confirmed_outflows_since_baseline`

- **SAMA:** خصم نجاح عرض = مبلغ العرض **+ 10 دج** ثابتة. نجاح 500 → خصم تشغيلي 510.
- **Arsselli:** خصم نجاح = المبلغ نفسه من **حساب الموزع المحدد**؛ 04/GTS و05/Mobilis أمثلة، ليست Offer Index.
- **Failed:** لا خصم. **Unknown/Review/Assumed:** لا خصم نهائي ولا إعادة مالية آلية؛ يمكن Reservation منفصل إذا تأكدت سياسة المحفظة.
- **لا TTL زمني يمنع التنفيذ** عندما يوجد Baseline ناجح وحساب تراكمي موثوق؛ انتهاء 6/12 ساعة لا يفرض قراءة قبل كل بيع.
- **المطابقة:** Trigger بالاستهلاك المؤكد منذ آخر Baseline (بداية **20,000 دج** قابلة للتعديل)، أو عودة شبكة/تعبئة خارجية/نتيجة غامضة/اختلاف فعلي؛ المقارنة `actual - expected` تُحفظ للمراجعة ولا تمحو التاريخ.
- **حد الرصيد المنخفض:** مستقل وقابل للضبط **لكل شريحة أو حساب مصدر**؛ إنذار الإدارة عند عبور الحد، مع منع سيل إشعارات مكررة. نفاد بطاقة التجهيز ليس مانعًا لكل Route مستقل.
- **فشل قراءة الرصيد:** لا تخمن صفرًا ولا تكرر USSD في حلقة. أول Baseline شرط مصدر جديد؛ بعده المطابقة المستحقة لا توقف شحنًا لمجرد مرور الوقت.
- **بطاقات تعبئة الشريحة:** تتبع مخزون بطاقات Mobilis 1000/2000 في نظام مستقل؛ لا تستعمل البطاقة أو تعاودها وهي REVIEW. لا تفعّل تعبئة ذاتية من دون سياسة معتمدة منفصلة.

**الحالة الحقيقية للميزات**:
- [CODE-VERIFIED] النواة التراكمية **موجودة** في MyTool Dev + Supabase (دالة `private.station_connect_operational_balance` وواجهة قراءة الإدارة). تخصم العمليات المؤكدة من Baseline وتحسب reconciliation_due. لا يلزم تحديث رصيد رقمي يدوي عند كل نجاح.
- [CODE-VERIFIED] زر `station_connect_admin_queue_balance`، وAgent `agent/src/balance.js` موجودان للقراءة الحقيقية؛ إعداد Sama حاليًا يحتوي زرًا يدويًا للاختبار/التشخيص.
- **[PENDING]** trigger/worker تلقائي موثق لأول Baseline بعد تجهيز SIM، وجدولة آمنة single-flight/backoff لمطابقة الرصيد، وتنبيهات Low/Empty التي تصل للإدارة — **لم يثبت أنها تعمل end-to-end في Flexy Mini الحالي**. لا نكتب نظام أرصدة جديدًا بدل إصلاح ربط الموجود.

## 6. كشف رقم الشريحة ≠ كشف عروض المستفيد

- **رقم الشريحة الموصولة:** خاصية SIM (ICCID/IMSI)، يمكن قراءتها من HiLink ثم وسيلة موثقة **مربوطة بنوع SIM الدقيق**. لا تعتمد على المتعامل وحده. Mobilis `*101#`، Djezzy `99` عبر Service Code مع Agent داعم؛ المسار النهائي يتحدد من سجل القدرات الدقيق.
- **اكتشاف عروض الزبون:** يستعلم عن *رقم الزبون المستفيد* عبر Sama ويستنتج Family/Group، لا يغيّر رقم SIM أو PIN أو مصدرها.
- Ooredoo `*200*PIN#` **غير مثبت كاستعلام آمن**؛ لا تجرّبه تلقائيًا ولا تستعمل PIN أو كود بطاقة تخمينًا. توجد حراسة DB تمنع تكرار استعلام رقم أوريدو بعد الخطأ حتى 24 ساعة + موافقة إدارة جديدة.
- لا تسجّل PIN، كلمة مرور، رقم بطاقة شحن، أو الرد الخام السري في Git أو Developer.

## 7. الدليل التاريخي ≠ اختبار منتج اليوم

**[DB-OBSERVED، 2026-10-13، أرقام تجميعية فقط بلا أرقام زبائن]:**
- `station_connect_jobs`: **17** `mobilis.offer.discovery` بحالة success، أحدثها 2026-09-28.
- `station_connect_offer_discoveries`: **28** سجل `DISCOVERY_COMPLETE` ناجح؛ أحدثها 2026-09-28. لم تعد ضمن TTL سبعة أيام بتاريخ الفحص، ولا ينبغي تقديمها كتصنيف صالح اليوم.
- `station_connect_jobs`: **4** `mobilis.offer.execute` success و**1** review مسجلة قديمًا؛ و**6** نجاحات لمسار `mobilis.flexy.arsselli.696` مع 3 إخفاقات تاريخية. هذه أدلة على مسارات سابقة لا على نجاح الشحن من **Flexy Mini الحالي**.
- قاعدة البيانات تحتوي SIM records متعددة؛ **وجودها لا يساوي وجود شرائح موصولة فعليًا**. يُفحص Heartbeat لكل محطة/مودم/شريحة عند القرار.
- [USER-PWA-OBSERVED] وصل `Flexy Mini` للهاتف بكود بناء مرئي `4c97c9c` عند عرض المحطات؛ تغييرات التأكيد اللاحقة كانت Source commits **وليست إثبات PWA عند الجهاز**. يجب الاعتماد على زر «نسخ النسخة» بدل توقع أن آخر Commit وصل.
- [USER-OBSERVED] النقر سابقًا على أزرار اعتماد Sama/الرصيد لم يُظهر Static Modal في PWA؛ لذلك نُقلت النافذة إلى تأكيد Inline في `src/SamaOperationalActions.tsx`. **ظهور التأكيد الجديد على الهاتف لم يُثبت بعد**.

## 8. حالات الأعمال (لا تختزل كل الحالات في نعم/لا)

| المكوّن | حالة صحيحة | الخطأ الذي نتجنبه |
|---|---|---|
| Station | pending / approved / suspended / revoked + heartbeat freshness | «متصل» اعتمادًا على آخر سجل قديم |
| SIM | unknown / mobilis-sama / mobilis-arsselli / ... مع ICCID/IMSI ومصدر الرصيد | مزج نوع شريحة واسم مجموعة العرض |
| Discovery | NEEDS_DISCOVERY / IN_PROGRESS / CLASSIFIED / UNKNOWN / NETWORK_ERROR | UNKNOWN = NO OFFERS |
| Catalog | معروف/مستورد/مدخل يدوي + سياسات عرض | وجود العرض = توفر منفذ تنفيذه |
| Route | verified/enabled/priority/candidate/review | if amount>=500 use Sama دون سياسة |
| Financial Job | queued / claimed / success / failed / review | timeout=failed أو ACK=success |
| Balance | UNINITIALIZED / READY / RECONCILIATION_DUE / DISCOVERY_UNAVAILABLE | قديم زمنيًا = صفر/غير صالح |
| Low-stock | normal / low / empty + dedup alert | إجبار كل الشرائح على حد واحد |
| Card Recharge | available/reserved/used/review/failed وفق نظامه | إعادة استخدام بطاقة معلقة/متشكك فيها |

## 9. خريطة الملفات وRPCs — الطريق الأقصر للفحص

### Flexy Mini UI
- `src/main.tsx`: Shell المشتركة، Auth، مسار `flexy` و`stations`، تنقل الإدارة/العميل.
- `src/FlexyServicePage.tsx`: إدخال رقم الزبون، عروض/رصيد، كتالوج حسب الدور، اختيار العرض، تأكيد الإرسال، idempotency محلي، فحص جاهزية Sama.
- `src/CustomerOfferIdentity.tsx`: cached discovery + explicit session request + تحديث الحالة؛ **الاستكشاف الحي للإدارة فقط حاليًا**.
- `src/SamaOfferDiscoveries.tsx`: السجل الإداري التاريخي داخل Flexy بوضع `historyOnly`.
- `src/StationOverview.tsx`: المحطات والمودمات والشرائح ومعلوماتها وتجهيز Sama والحراسة الخاصة بأوريدو.
- `src/SamaOperationalActions.tsx`: حالة الجاهزية، الاعتماد الإداري، وزر رصيد احتياطي بتأكيد Inline؛ **ليس محرك الرصيد التلقائي**.
- `src/BuildCopyButton.tsx`: نسخة الـPWA المثبتة مع مرجع GitHub Actions.

### Supabase (قاعدة مشتركة)
- `public.flexy_offer_catalog`، `flexy_offer_execution_routes`، `flexy_offer_role_policies`: العروض والطرق والعرض حسب الدور.
- `public.station_connect_stations`، `station_connect_modems`، `station_connect_sims`: المورد المادي وحالته وهويته.
- `public.station_connect_jobs`، `station_connect_sessions`، `station_connect_commands`: سجل العمل/الأوامر، له حالة ونتيجة؛ لا ينشأ Ledger ثاني.
- `public.station_connect_offer_discoveries` و`station_connect_offer_observations`: تاريخ اكتشاف أرقام العملاء والردود الموثقة.
- `private.flexy_customer_offer_discovery_settings`: مدة الصلاحية القابلة للضبط.
- `public.flexy_mini_admin_customer_offer_identity`: تصنيف المستفيد من Discovery موثوق.
- `public.station_connect_admin_create_offer_discovery`: جلسة استكشاف عبر Sama.
- `public.flexy_mini_admin_create_verified_offer_execute`: ربط مستفيد/Discovery/عرض قبل التفويض للتنفيذ.
- `public.station_connect_admin_create_offer_execute_v2`: المسار المالي القائم لدى Station Connect.
- `private.station_connect_operational_balance` / `station_connect_admin_sim_operational_balances`: الحساب التراكمي وقراءة الإدارة.
- `public.flexy_mini_admin_sama_readiness`: فحص جاهزية بدون USSD.
- `public.station_connect_admin_set_sim_flexy_approval`، `station_connect_admin_queue_balance`: اعتماد وسؤال الرصيد اليدوي عند الحاجة.

### Station Connect
- `agent/src/index.js`: حلقة Agent/heartbeat/Claim (نسخة مصدر GitHub المفحوصة 0.4.12، **ليست إثبات إصدار المثبت على المحطة**).
- `agent/src/command-executor.js` و`agent/src/workflow.js`: تنفيذ أوامر تقنية USSD.
- `agent/src/balance.js`: قراءة رصيد شبكة Sama.
- `server/supabase/functions/station-gateway/orchestrators.ts`: متابعة ردود الشبكة والجلسات بمنطق السيرفر.
- `contract/station-api-v1.md` و`docs/ARCHITECTURE.md`: العقد/المسؤوليات.
- `amordz72/station-services/services/hilink-modem/`: قدرة HiLink عامة (فحص Windows حقيقي مستقل قبل الاستبدال).
- **الـAgent المثبت ليس بالضرورة آخر Source Commit. لا تحدّثه عشوائيًا بدون صورة SHA/Version ومراجعة البروتوكول.**

## 10. المخالفات/الثغرات التي وجدناها — لا نقفز فوقها

1. **[PENDING]** أول قراءة تلقائية للـSIM واستدعاء المصالحة والتنبيه منخفض الرصيد لم تثبت end-to-end، رغم وجود Core DB تجميعي منذ سبتمبر. المطلوب وصل الناقص، لا اختراع نموذج آخر.
2. **[PENDING]** `SamaOperationalActions` يعرض زر «قراءة الرصيد» يدويًا؛ هذا **fallback / diagnostics** وليس طريقة التشغيل النهائية المعتمدة. يجب تغيير السلوك لاحقًا لا الاكتفاء بالوثيقة.
3. **[PENDING]** مسار `FlexyServicePage` الحالي يرسل عبر Sama فقط؛ السياسة الأحدث تسمح Routes متعددة/Arsselli إذا ثبتت وأُذن بها، فلا تخلط نطاق pilot بسياسة المنتج الأبدية.
4. **[PENDING]** تأمين تنفيذ العملاء بالمحفظة وبـRPC/Backend مخصّص لا يسمح بالاستعلام عن أرقام اعتباطية؛ لا فتح admin RPCs للكل.
5. **[PENDING]** تدقيق ربط Session→SIM والـmodem بعد تبديل USB/IP، idempotency عند فشل الاتصال ومراجعة UNKNOWN قبل أول تجربة مالية من Flexy Mini.
6. **[PENDING]** اختبارات PWA/CI المنشورة للنسخة الجديدة وتأكيد دور الإدارة/العميل/تأكيدات الهاتف.
7. **[KNOWN STALE DOC]** كان `README.md` في Flexy Mini يصف المشروع بأنه Scaffold بلا Station Connect أو تنفيذ مالي، وهذا مخالف للكود الحالي؛ يجب تصحيحه والربط بخريطة السلوك.
8. **[HISTORICAL VS CURRENT]** ملف Developer `projects/flexy/MASTER-REFERENCE.md` يصف `flexy-mini` كـ`EMPTY` في فقرة من 2026-08-31؛ هذا وصف تاريخي **SUPERSEDED** بكود 2026-10-13.
9. **[PENDING]** Execution Profiles Schema موجودة لكن مسار التنفيذ الحي لم يثبت اعتماده كليًا؛ لا نقل Profiles إلى كل عرض ولا فرض ترحيل كبير بلا اختبار.
10. **[PENDING]** سياسة threshold والتنبيهات لكل SIM تحتاج واجهة إعداد واختبار منع تكرار الإشعارات، والرصيد التفصيلي مع فرق المطابقة.

## 11. ترتيب الإنجاز القادم (بدون إعادة اختراع)

1. اقرأ هذه الخريطة و`mytool-dev/flexy/policy/CURRENT-POLICY.md`؛ افحص SQL الإنتاج الحالي والـAgent المثبت، ولا تبدأ SQL جديدًا قبل مراجعة القائم.
2. **الأولوية الحالية:** أكمل Automatic Opening Balance / initial Baseline لشرائح Sama بعد تعريفها واعتمادها، بالاعتماد على Job queue نفسها وبـsingle-flight/fail-safe؛ لا تجعل المدير يضغط «قراءة الرصيد» كل مرة.
3. أثبت من Core ببيانات اختبار معزولة أن شحن Sama 500 يخصم 510 **مرة واحدة**، وFailure/Review لا يخصمان مؤكدًا، ثم مصالحة على الحد مع تسجيل Delta.
4. فعّل Low/Empty alerts لكل SIM/Account في الإدارة مع Threshold قابل للتغيير وdedup؛ سجّل الدليل الميداني، لا تكتفِ بتوثيق.
5. افحص UI الهاتف ووصول كود البناء وتأكيد المستخدم وحراسة Session→SIM.
6. بعد التهيئة الآمنة، تجربة اكتشاف واحدة ثم **شحن فعلي واحد بإذن المستخدم الصريح**، مع مرجع الطلب والناتج/الخصم والمطابقة.
7. توسع لاحقًا إلى Arsselli/Routes إضافية والعملاء فقط بعدما تثبت السياسة والقدرات الفعلية؛ لا تستبدل pilot بوعود غير مختبرة.

## 12. طريقة تحديث هذه الخريطة بعد كل تجربة

لكل Feature أو عطل سجل **في هذا الملف أو وثيقة ملحقة مرتبطة به**:
- **طلب/سلوك المستخدم** + الخطأ الذي كان يحصل؛
- **المكوّن المالك** (Flexy Mini / DB MyTool / Station Connect / Station Services)؛
- **ما رأيناه** (Code/DB/فيديو/نتيجة اختبار) + التاريخ + Commit / Migration / Run ID إن توفر؛
- **ماذا نعرف أنه نجح** مقابل **ما بقي غير مُتحقق**، وهل أُرسل USSD/شحن أم لا؛
- **القرار الحالي** وهل يلغي قرارًا تاريخيًا؛
- **الاختبار التالي المحدد** فقط.

**قاعدة الحفظ:** Developer يشير إلى هذه الخريطة ويحتفظ بالمعرفة العامة؛ التفاصيل التنفيذية والملفات وآخر فحص داخل Flexy Mini. لا تُنسخ هذه الوثيقة كاملة في Developer. لا تُدخل فيها بيانات حساسة أو PIN أو أرقام زبائن أو أرصدة شخصية.


## 13. 2026-10-13 — متابعة UX وربط الاكتشاف من تصحيح البناء

**USER-APPROVED:** رقم مستفيد واحد، رصيد عادي افتراضي، زر عروض لنفس الرقم؛ لا إعادة بناء الرصيد ولا شحن حقيقي أثناء التطوير.

**الدليل قبل التعديل:** Actions `38392986175` للتصحيح `96c78a8473b1b812ecb561dafd896c085e1ba644` نجح في build/deploy، وPages JavaScript احتوى SHA نفسه. هذا دليل الموقع المنشور، وليس PWA Android المثبتة. راجعنا المصدر الحالي لـMyTool `flexy/index.html` وTehna `CustomerFlexy.php` وBlade، ثم RPCs الإنتاج وStation `orchestrators.ts`؛ لا نسخ تصميم أو Backend جديد.

**IMPLEMENTED / LOCAL TESTED:**
- `src/FlexyServicePage.tsx`: البداية رصيد عادي؛ حقل هاتف واحد LTR يطبّع +213/213 والمسافات؛ تغيير هوية الرقم يمسح الاختيار/تصنيفه ويعيد وضع الرصيد، مع الاحتفاظ بالطلب المالي المعلق منفصلًا. اختيار عروض يقرأ Cache أولًا. بطاقة الاستكشاف تبقى مركبة أثناء تبديل الوضع لمنع فقد مرجع جلسة جارية.
- `src/CustomerOfferIdentity.tsx`: عند طلب العروض وغياب Cache صالح يظهر تأكيد داخل الصفحة. التأكيد وحده يستدعي `station_connect_admin_create_offer_discovery`؛ لا USSD عند فتح الصفحة أو كتابة الرقم. متابعة read-only بواسطة `station_connect_admin_offer_discovery_job` كل 3 ثوانٍ، بحد 60 قراءة/3 دقائق، ثم يبقى تحديث يدوي. نجاح الجلسة يعيد قراءة التصنيف لعرض Catalog المجموعة نفسها. لا Retry تلقائي، ولا تعذر شبكة = بلا عروض.
- قفل النقر المزدوج؛ حراسة كل رد Cache/Job/Queue متأخر بهوية الرقم وجيل المكوّن. فقد رد Queue يمنع طلبًا جديدًا حتى يثبت وجود الجلسة الجارية عبر القراءة؛ لا اعتبار غياب المرجع نجاحًا.
- تأكيد الإرسال المالي أصبح Modal controlled داخل شجرة React بدل `Modal.confirm` الساكن؛ يظهر الرقم والعرض والمصدر وتكلفة Sama (المبلغ+10). قفل إرسال متزامن. REVIEW المالي لا يعرض زر إنشاء طلب جديد/إلغاء مفتاح الطلب، ويظل الطلب محفوظًا.
- نسخة الواجهة ظاهرة وقابلة للنسخ في صفحة الدخول أيضًا (`src/main.tsx`) لإثبات ما حمّله المتصفح قبل تسجيل الدخول.
- `tests/flexy-recipient.test.mjs`: 11 اختبارًا مع React effects الحقيقية وRPC/UI stubs معزولة؛ نجحت حالات الرصيد الافتراضي، الهاتف، Cache صالح/منتهي، تأكيد ونقرة مزدوجة، polling، رد قديم، ضياع Queue، خطأ شبكة، حد polling، منع RPC الإدارة للعميل، وقفل REVIEW. الاختبارات لا تتصل بقاعدة أو مودم. GitHub Pages workflow يشغّلها قبل البناء.

**الحدود المثبتة:** Read-only DB يثبت Sama حديثة متصلة ومعتمدة وPIN محفوظ؛ لا ينقل ذلك إلى إثبات رصيد أو USSD من النسخة الحالية. Routes العرض: 18 Sama verified/enabled، و7 Arsselli draft/disabled. RPC المالي ما زال Sama-only، ولم نفعل Arsselli draft أو نحوله إلى رصيد عادي. الرصيد العادي والعملاء ماليًا/استعلام العملاء يبقون غير مفعّلين حتى مسار جاهز وصلاحية خادم مناسبة. نواة الرصيد التراكمي وبيانات MyTool لم تتغير.

**CI + WEB VERIFIED / ANDROID PWA PENDING:** المصدر `00392b524a087acb8b516b6033ad4d43aee6432f`؛ Actions `38394791189` نجح (11 اختبارًا + TypeScript/Vite + Pages deploy). بعد reload في متصفح الاختبار ظهر «نسخة الواجهة: 00392b5» في صفحة الدخول. هذا يثبت نسخة الويب فقط، لا PWA Android الخاصة بعمر ولا UI مسجل الدخول أو تجربة مودم فعلية. التأكيد النهائي لوصول PWA والاكتشاف الحقيقي عبر المحطة لا يزال PENDING. لم يُرسل أي USSD أو شحن ولم تكتب هذه المهمة أي بيانات DB. الخطوة القابلة للتحقق: SHA النسخة الجديدة ثم تجربة استكشاف واحدة بإذن الإدارة داخل الصفحة؛ تجربة مالية منفصلة بتأكيد عمر.

**أخطاء التحقق وتصحيحها:** TS2339 الأصلي تم حله في `96c78a8` ونجح CI؛ اختبار React المعزول احتاج إضافة `Descriptions` إلى UI stub ثم نجحت الاختبارات الـ11؛ استعلام قراءة افترض `station_uuid` مباشرة في SIM فرفضه PostgreSQL وصُحح الربط إلى `SIM.modem_uuid → Modem.station_uuid`. RPC جاهزية الإدارة رفض نداء SQL بلا سياق إدارة بـ`ADMIN_REQUIRED`؛ لم نضع هوية مصطنعة أو نخفف الحراسة، واعتمد تقرير الموارد التجميعي read-only. لا أثر كتابي على DB من هذه الأخطاء.


## 14. 2026-10-13 — Screenshot acceptance and discovery queue blocker

USER-PHONE-OBSERVED: first two screenshots are Flexy Mini on Android and display `d0c2585`; third is the real external comparison program, showing a single phone with credit/offers and Sama Mix/Talk/Net. Do not attribute its successful visible catalog to Flexy Mini. The screenshots confirm phone delivery of d0c2585 and signed-in offer UI, not discovery completion or financial success.

READ-ONLY DB: latest three discovery jobs remain claimed with one queued ussd_start each, no result/completion. Station heartbeat is fresh (Agent 0.4.10). `station_connect_claim_command` selects the oldest queued command first, then returns without claiming when its modem/session/SIM checks fail. Oldest queued record dates 2026-09-30, session open, modem stale and SIM no longer bound to that modem; other older queued records also have stale modems. This confirms a head-of-queue blocker in source plus current queue evidence; claimed on Job is not evidence that the Agent received USSD. No command was claimed by this inspection, no queue row mutated, no USSD initiated.

NEXT: fix stale-command queue handling in Station Connect with isolated tests, explicit expired/not-dispatched outcomes and SIM/session freshness; never replay expired commands, weaken identity checks, or blindly release old pending financial/Ooredoo requests. Verify after controlled deployment. UI should expose awaiting-station/time-out rather than indefinite misleading claimed. Preserve screenshot classification and no-secret documentation.


## 15. 2026-10-13 — مدة صلاحية الأوامر / USER-APPROVED + DB APPLIED

قرار عمر: الأوامر القديمة تلغيها Station بعد دقيقتين إلى دقيقتين ونصف. اعتمدنا **150 ثانية** للأمر المنتظر، مع منع التسليم بعد انتهاء المدة حتى لو عادت المحطة من انقطاع. الإلغاء المادي للسجل يتم عند heartbeat/claim التالي؛ لا Scheduler منفصل وقت انقطاع المحطة.

المالك: Station Connect / Server Adapter، source `eeb49a21f165cd3f2edebc54abf46ca291030eda`، migration `20261013122038_station_command_queue_ttl_150_seconds.sql` مطبقة ومسجلة. العقد والاختبارات والrollback: [Station queue expiry](https://github.com/amordz72/station-connect/blob/main/docs/COMMAND-QUEUE-EXPIRY.md). Agent 0.4.10 الموجود لم يتغير.

نجح اختبار rollback على الـSchema الفعلية قبل وبعد التطبيق: حد 149/150، الحراسة، تجاوز رأس غير جاهز، idempotency، عدم Retry، heartbeat، legacy queue، REVIEW عند وجود إرسال سابق، وعدم طمس رد أمر claimed. CI Station `38397700314` نجح. نتيجة الإنتاج: **8 أوامر قديمة ألغيت تلقائيًا؛ صفر أمر منتهي ما زال queued**؛ استعلامات العروض الثلاثة العالقة أصبحت failed / QUEUE_EXPIRED_NOT_DISPATCHED. لم نبدأ USSD أو شحنًا حقيقيًا، ولم نغيّر Master أو الرصيد التراكمي أو المحافظ. الأوامر claimed الفعلية لا تُلغى كأنها لم ترسل؛ نحتفظ بدليلها، وطلبات المال المرتبطة تبقى محجوزة/للمراجعة عبر metadata دون تسوية أموال.

خطأ الأداة: apply_migration أعاد Invalid or expired requestState مرتين؛ تحققنا من عدم التطبيق، ثم طبقنا SQL atomically بواسطة execute_sql وأثبتنا schema/history. No advisor notice names the new expiry functions. اختبار اكتشاف جديد على المودم ما زال PENDING؛ لا تعاد الطلبات المنتهية تلقائيًا.


## 16. 2026-10-13 — واجهة مباشرة وجدول العمليات / IMPLEMENTED + LOCAL TESTED

قرار عمر: كل صفحات التطبيق تعرض المعلومات الأساسية مباشرة وبأسلوب مهني؛ إزالة الشروحات المكررة وكتل التعليمات. صفحة الفليكسي تعرض آخر العمليات في **جدول ظاهر**: الرقم، الخدمة، اسم العرض، المبلغ، الحالة، التاريخ، رمز النتيجة ورد الشبكة كاملًا، وتفاصيل الردود لكل خطوة من الصف. مصدر `f687c9dc6effaa2c2d485a2f90a59865398caf0b`؛ التفاصيل في [CONCISE-UI-AND-OPERATION-TABLE.md](CONCISE-UI-AND-OPERATION-TABLE.md).

12 اختبار React/RPC وبناء TypeScript/Vite نجحوا. RPC `flexy_mini_admin_recent_operations` read-only مطبقة ومسجلة migration `20261013125748`، pagination من السيرفر، admin guard قبل البيانات، لا anon، ولا قيم أوامر/PIN صادرة؛ PIN المحفوظ يحجب داخل ردود الشبكة إن ظهر. اختبارات SQL rollback أثبتت الحراسة والpagination والرد الحقيقي الأخير دون إخراج أرقام خاصة أو أسرار. إعدادات المحطات والبطاقات والمحافظ والزبائن والموردين اختصرت الشروحات مع إبقاء البيانات وحدود الخدمة والتأكيد المالي والأخطاء.

الخلل التشغيلي الحالي المثبت: الاستعلام الجديد وصل المودم وأرجع `Please Enter your PIN code`؛ classifier لا يتعرف عليها (mot de passe/password فقط) فأغلق الجلسة بـDISCOVERY_TERMINAL. تحسين الجدول **لا يعني إصلاح parser**. التالي: جمع اختبارات وتجارب المشاريع السابقة ومراجعة lifecycle كامل ثم تصحيح/اختبار/نشر السيرفر، لا تكرار الطلب ولا اتهام PIN أو الاستنتاج أن المستفيد بلا عروض. CI/نسخة الهاتف الجديدة PENDING إلى حين إثباتها. لا USSD أو مال أو تغييرات بيانات MyTool في هذه الدفعة.


## 17. 2026-10-13 — PIN classifier / SOURCE + EDGE DEPLOYED, LIVE DISCOVERY PENDING

User's new recipient discovery reached the actual modem with `Please Enter your PIN code`, but Station gateway `isPinPrompt` recognized only `mot de passe`/`password` and released as `DISCOVERY_TERMINAL`. This was NOT a wrong PIN or recipient without offers. Prior Tehna/Core PIN/offer/menu/confirmation fixtures were checked before correction. See [Station PIN response record](https://github.com/amordz72/station-connect/blob/main/docs/SAMA-PIN-PROMPT-2026-10-13.md).

Station-owned fix: `pin-response.mjs` English/French/Arabic prompt and rejection classifier, server-only once-per-session `pin_submitted` guard, review on repeat, failed on explicit rejection, retained confirmation/menu/discovery flow. Source commits `0c55d125`, `310c2eb5`, `e4f24b60`, `32c0638c`, CI step `1fd29236`. Prior Edge `station-gateway` v20 had extra runtime routing absent from GitHub; synchronized with full running code instead of overwriting it. New Supabase Edge `station-gateway` **v21 ACTIVE**, 4 deployed file contents match GitHub. No Windows Agent update or DB migration. 27 isolated Node tests passed; GitHub Actions final conclusion not independently observed.

**Verification levels:** source UPDATED; offline tests PASS; Edge DEPLOYED/ACTIVE; actual PIN continuation on live Station **NOT YET TESTED**, no USSD triggered by this update, no financial send or ledger/MyTool mutation. Flexy Mini frontend remains the concise-table release `79ff678`. One explicit new recipient discovery through Flexy is now the single next live acceptance step: observe PIN command and menu result in the operation table. No surprise retry or real financial send.


## 18. 2026-10-14 — Stable SIM & Station names / DB APPLIED, PAGES DEPLOYED, PHONE QA PENDING

**User-approved behavior:** automatic, permanent, nonrecycled display identifiers per service type (`sama-1`, `arsely-1`, etc.) for known SIMs and `server-1` for each Windows Station. A user-defined, fully optional label is displayed on the next line; examples: `عمر سما1`, `zb`, `6g`, `PC bach`. Empty label shows no placeholder. Backend UUID/ICCID identification never depends on alias or IP.

**Owning repositories:** Station Connect owns shared schema, persistent numbering and authenticated admin-only RPCs. Flexy Mini reuses its existing Ant Design `StationOverview.tsx` (no new page) for display/edit. There is no Windows Agent update or change to USSD, wallet, routing, PIN, approvals, pricing or MyTool shared ledgers.

**Source only / verification pending:** 
- Station migration: `station-connect/server/supabase/migrations/20261013_station_identity_display_labels.sql`, merged to main as `77dcd91c`, and **APPLIED** to shared Supabase on 2026-10-14. Readback: 2/2 stations and 6 recognized SIMs have unique codes; 7 unclassified SIMs keep null code by design. `anon` RPC access denied; admin permissions required. No Windows Agent or financial operation.
- Flexy Mini UI: `src/StationOverview.tsx` branch `feature/station-identity-labels-20261013`; read-only `station_connect_admin_identity_labels` and write-only-for-alias `station_connect_admin_save_identity_label`, both admin-gated on backend. Legacy station fallback remains before migration.
- CI test fixture: `tests/station-identity.test.mjs` uses fake data/RPCs only and asserts station + SIM codes, optional alias edit and no USSD/PIN/type side effects.
- **User-approved acceptance path (2026-10-14):** owner explicitly waived waiting for hosted automated tests, preferring hands-on testing. Open Stations, confirm service types, edit/clear an alias, refresh web/PWA, then verify identifier persistence. No real USSD/financial execution as part of label testing.
- Verified CI (previous Flexy feature-branch run `38478920862`): PASS 21/21 and TypeScript/Vite build. Station Windows CI failed before test execution, waived for this user acceptance release, not misrepresented as green. DB applied; Flexy Mini Pages workflow `38483230412` **SUCCESS** on `5d9ad52` with Development Guard `38483230515` **SUCCESS**. Installed Android PWA acceptance and physical Station behavior still need user confirmation.

Canonical design context: `amordz72/developer/projects/station-connect/CENTRAL-USB-SIM-BRAIN-2026-09-24.md`. Database migration/test details: `station-connect/docs/STABLE-IDENTITY-LABELS-2026-10-13.md`.

## 22. 2026-10-14 — Filter modem/SIM list by permanent server code

- **Owner request / screenshot:** Stations view should filter **by `server-N`**, not modem's LAN IP or USB address. Existing SIM names like `sama-3` and `arsely-2` remain distinct from their parent Station.
- **Owner component:** existing `src/StationOverview.tsx` using **Ant Design Select/Table/Card**. Add `كل السيرفرات` + a choice for each actual station UUID, display its server code and optional alias. Selecting a station must show only its own observed modems/SIMs; ALL must show results across stations with their owning station code visible. Reuse existing server-side authorized `station_connect_admin_hardware(p_station_uuid)` reads; no new tables, migrations, custom UI framework or new read RPCs.
- **Privacy/safety:** existing per-SIM PIN, service type and phone actions must retain correct station context across filtering. Filtering alone is read-only. Station `station_uuid` remains the key; no reliance on IP or alias.
- **State:** `MERGED / PAGES DEPLOYED SUCCESS / ANDROID USER ACCEPTANCE PENDING`. Source `2d49c64` (station-scoped reads and actions), `385c79d` (Ant Design select and mobile/desktop view), tests `0a449ee` (two-station mocked reads, All↔server filter and PIN station context). GitHub Development Guard PR run [38484206164](https://github.com/amordz72/flexy-mini/actions/runs/38484206164) **SUCCESS**, including tests + TypeScript/Vite build. Squash merged PR #5 to `bbacf1f2bd4092ff4773bfb0c5a4dbe95e205d7d`; main Pages [38484378950](https://github.com/amordz72/flexy-mini/actions/runs/38484378950) **SUCCESS**, including source tests, build, architecture checks and Pages deploy. No DB migration and no network/USSD command. Current screenshot PWA previously loaded `5d9ad52` and must be refreshed; actual phone filter acceptance remains unconfirmed.

## 23. 2026-10-14 — Unified server-first Stations/SIMs UI (owner-approved)

**Decision:** The existing `المحطات والشرائح` page begins with the server filter; each server displays its own modem/SIM hardware and SIM controls directly below it. There is no independent top-level `شرائح Sama` list. Display codes (`server-N`, `sama-N`, `arsely-N`) remain immutable; an alias is optional and distinct. `كل السيرفرات` groups each modem beneath its owning server; the current selection is stored in browser localStorage under an authenticated user-scoped key, and stale/inaccessible selection reverts to All. Do not persist this as a database-side preference or use modem IP as identity.

**Implementation owner:** `flexy-mini/src/StationOverview.tsx` uses existing Refine/Ant Design `Select`, `Card`, `Descriptions`, `Table` and `Collapse`; `src/SamaOperationalActions.tsx` is now per-SIM controls and `readSamaStatus()` is fetched once in the parent. Status rows must match both `sim_uuid` and `station_uuid`. A Mobilis Arsselli SIM cannot show a Sama setup prompt merely because it is on the same network. Approval and network-balance actions retain their existing, explicit confirmation flow and server RPCs; configuration for SIM type/phone/PIN remains linked to the owning station. Station and hardware status is refreshed every 30 seconds; 90-second age check is recomputed to avoid a stale green online badge.

**Scope:** Frontend only, existing RPCs read/actions; no DB migration, station Windows Agent update, PIN/USSD/recharge execution, money change, pricing/routing change or independent layout framework. Source PR: [Flexy Mini #6](https://github.com/amordz72/flexy-mini/pull/6). CI, Pages deployment and phone/PWA acceptance are distinct gates and must be updated with actual results, never inferred from source edit alone.

**Phone acceptance:** Verify latest build SHA; filter `server-1`, `server-2`, `كل السيرفرات`, reload and confirm persisted choice, change accounts and verify user-isolation; verify station label/alias, connected/disconnected state after actual heartbeat timeout and that Sama/Arsselli controls appear only under their real SIM without duplicates. Do not initiate balance/USSD/financial action as part of the layout check.

## 24. 2026-10-14 — Mobile station layout refinement (review branch)

**Owner request:** Correct the user-accepted server-first screen's duplicated page heading, very long modem cards and the build-copy overlay obscuring content, without changing server filter behavior or modem/SIM identity.

**Implementation:** In `StationOverview.tsx`, the page-level heading remains the single title; the Ant Design filter Card no longer repeats it. On mobile, each Ant Design modem Card keeps the SIM identifier, number, type and available Sama ledger balance immediately visible; the existing Ant Design Collapse reveals IP, operator, PIN safety state, Sama discovery readiness and SIM actions when needed. The server's last connection, agent version, approval and online status remain visible; desktop Ant Design Table is unchanged. `BuildCopyButton.tsx` remains an admin-only fixed Ant Design FloatButton, now a 40px icon with tooltip instead of a 105px label overlay.

**Non-goals:** No server/Agent upgrade, Supabase/RPC changes, USSD, account/finance operations or new CSS/framework. Persistent per-account server filter and 30s refresh / 90s offline threshold unchanged.

**Verification:** Review branch requires development-guard pass/rejection tests, npm test, build and Pages deploy status after merge. Android PWA UI confirmation remains a separate user acceptance gate.

## 25. 2026-10-14 — Fix mobile nested modem-card overlap

**User observation:** Installed Android screenshot after §24 showed a ghosted/overlapping «التفاصيل وإعدادات الشريحة» line between two modem cards on server-2, although two distinct modem cards and their own single Ant Design Collapse were rendered.

**Source audit:** `src/style.css` set `.app-content .ant-card{height:100%}` globally. This also affected the nested mobile station/modem Cards inside Ant Design Space, forcing them to match a parent height instead of their contents. Each modem already had exactly one Collapse in `src/StationOverview.tsx`; no duplicate UI data or database rows are implied by the screenshot.

**Fix:** Narrow the existing equal-height CSS rule to `.app-content .ant-row > .ant-col > .ant-card{height:100%}` so Ant Design grid cards can stretch but normal nested mobile modem Cards retain natural height. No new CSS file, parallel UI component or business logic change. Add automated UI fixture for mobile mode (exactly one Collapse per modem) and CSS specificity regression assertion in the existing `tests/station-identity.test.mjs`.

**Boundaries:** Frontend CSS + isolated regression tests only; no SIM/station identity, Station Agent, RPC, Supabase, USSD, PIN, balance or routing changes. Source branch/PR and verification SHA to be recorded after CI. GitHub Pages deployment and Android installed-PWA visual acceptance remain independent verification gates.

## 26. 2026-10-14 — USB and Serial identification on modem cards (owner-approved)

**User decision:** The primary modem label is the stable system-issued `USB 001` / `USB 002` from `public.station_connect_modems.usb_number`. The user can stick this USB code to the physical modem. Under it display a recognizable trailing fragment (normally 6 characters) of the **actual modem Serial Number** as a second independent check if the label is lost or the modem is moved to another computer. When suffixes collide, expand enough characters for uniqueness; if the full serial still conflicts, visibly flag `متكرر`. No user-editable modem nickname or invented sequence from list order/IP/Windows adapter.

**Identity contract:** The existing read-only admin RPC `station_connect_admin_usb_sim_center()` (from Station Connect migration `20260924_005_stable_usb_number_and_sim_observations.sql`) returns `modem_uuid,station_uuid,usb_number,usb_label,serial_number`. The current Flexy Mini hardware list still comes from `station_connect_admin_hardware(p_station_uuid)`. In `src/StationOverview.tsx`, join these by **exact modem UUID plus current station UUID** and display the USB code and Serial suffix on **both** mobile AntD Card headings and desktop AntD Table. The SIM (ICCID-based identity and existing `sama-N`/`arsely-N`) remains beneath the modem and can move independently.

**Safety:** The page must not invent a USB code or serial from position/IP/name; on missing or unauthorized USB-directory data, show `USB غير متاح`, `Serial: غير مقروء` and a warning. Missing individual serials are also labeled as unreadable, rather than silently substituting an IMEI. Do not render the full serial by default or place hardware secrets in Developer. The model name stays in the existing expanded technical details. Reads only; no DB schema, Station Agent, SIM type, PIN, USSD, wallet/ledger or billing changes.

**Tests:** Use the existing `tests/station-identity.test.mjs` mocked RPC fixtures to verify stable mapping across two stations, same USB number in mobile/desktop layouts, suffix collision expansion, true duplicate serial warning, missing-data fallback, server-filter persistence and no write/USSD calls. Review via PR and Development Guard + build. Distinguish source merge, main Pages deployment and actual PWA acceptance.

## 27. 2026-10-14 — Offline safe offers view and execution readiness audit

**Observed:** With physical Station Connect computers powered off, both station heartbeats are stale (>=90 seconds), so `flexy_mini_admin_sama_readiness()` reports `station_online=false` and `discover_ready=false`. The backend `station_connect_admin_create_offer_discovery` independently rejects discovery without a freshly online approved station, modem, Mobilis Sama SIM and service PIN. The existing front end only passes `stationUuid` to CustomerOfferIdentity when `discover_ready=true`. Thus an offline admin can read cached recipient-group results without creating a discovery/USSD job; absent a valid cached classification, no offers are authorized for that recipient.

**Read-only production audit (2026-10-14):** Mobilis execution routes: 18 Sama routes `verified/enabled`, 7 Arsselli offer routes `draft/disabled`. The currently active `flexy_mini_admin_create_verified_offer_execute` path is Sama-only. Do **not** enable or simulate Arsselli-offer execution by reusing ordinary Arsselli credit routes, and do **not** start live financial operations as part of this phase. The approved product policy remains Sama-first, with verified same-offer Arsselli fallback only after proper independent route/cost verification, pre-dispatch; otherwise service unavailable.

**UI-only change:** Show an existing Ant Design informational Alert in `src/FlexyServicePage.tsx` when no discover-ready Sama source is selected and the observed Sama station is offline: cached results are readable, but new network discovery and send remain unavailable. No new buttons, fake offers, custom layout or non-framework CSS. Added mocked front-end tests for cached identity and missing identity in offline mode; assert no discovery job, USSD or paid execution is queued.

**Future real-device acceptance:** When the owner turns on Station Connect, verify fresh heartbeat, exact SIM identity, baseline and source readiness via existing RPCs before requesting one owner-approved *non-financial* discovery. Check raw network result and catalog mapping; keep paid sending separately confirmed. No Station Agent, DB, financial or USSD changes in this offline change.

## 28. 2026-10-14 — Arsselli balance first, per real SIM (owner requested)

**Current priority:** Owner requested the Arsselli balance before new offer-discovery tests; screenshot shows the Arsselli SIM on USB 012 (Station server-2), online recently with PIN already saved. A read-only production query found **zero confirmed Arsselli distributor account balance snapshots for this SIM**. Never show zero as a substitute for missing data.

**Existing backend:** Reuse `station_connect_admin_arsselli_balances(p_sim_uuid)`, `station_connect_admin_arsselli_recent_responses(p_sim_uuid,p_limit)`, `station_connect_admin_queue_arsselli_balance(p_sim_uuid)`, and `station_connect_admin_arsselli_balance_job(p_job_uuid)`, including SMS parsing and `station_connect_arsselli_account_balances` as the source of truth. No duplicate ledger, parser or Client-side USSD implementation. For future queries the Station Connect correction `20261014144000_arsselli_balance_physical_modem_identity.sql` removes a legacy `192.168.87.1` *identity gate* in the existing queue RPC; the actual current modem is chosen via SIM's immutable `modem_uuid` relationship and current fresh 90-second SIM/modem/station observations plus stored PIN and admin authorization. No automatic or silent network query, and no Agent upgrade.

**UI:** `src/ArsselliBalanceActions.tsx` is an Ant Design-only, SIM-scoped panel inside the existing Station Overview details, for `mobilis-arsselli` only. Read stored account rows, show GTS code 04 as primary even if its actual saved amount is 0, other nonzero distributor balances separately; never sum accounts. Display the last *confirmed read* timestamp, not the time the screen refreshed. A new read requires an explicit button followed by a separate confirmation click; read-only refresh is distinct. Queue returns a job UUID; polling/refresh calls the existing *read-only* status RPC. `ARSSELLI_BALANCE_SMS` is confirmed only with a new SMS; `BALANCE_SMS_PENDING` stays unconfirmed, no guessed balance. Lost queue response blocks repeated attempts until review. Do not show the PIN value, and do not store it in git/logs.

**Verification:** CI mock tests: confirmed GTS 0 vs no snapshot, independent accounts, offline-disabled network request, two-step explicit query, existing pending-job recovery and lost-response no-retry. Station Connect Agent CI static regression: no hard-coded modem IP, admin/PIN/fresh hardware guards. PR/CI, database migration and installed PWA proof are **separate gates**; never claim the real SMS balance is known until a successful Station/agent test.

**Verified delivery gates (2026-10-14):** Flexy Mini PR [#11](https://github.com/amordz72/flexy-mini/pull/11) merged to main as `35dddc71129afb755c7a0ee209b8a4012985f3d7`. Development Guard, all behavior tests (including five new Arsselli tests), TypeScript and production build [#38573888910](https://github.com/amordz72/flexy-mini/actions/runs/38573888910) **SUCCESS**. Station Connect PR [#5](https://github.com/amordz72/station-connect/pull/5) merged to main as `c0a89b2ee57924aec1bd14833e80ff787c31b00d`. Supabase migration `arsselli_balance_physical_modem_identity_20261014` **APPLIED successfully**, readback confirmed the queue function no longer uses a fixed IP and still checks modem UUID, recent SIM, admin privileges, denied anon execute. Station Connect Windows and supplemental Linux Actions runners failed to start their jobs (no steps/log artifact) — those CI checks are **UNVERIFIED/FAILED**, not falsely reported as passing; source contract reviewed directly. No live Arsselli network read was sent. **NEXT:** confirm latest PWA build and ask the owner to open USB 012 → arsely-2 → تفاصيل وإعدادات الشريحة, confirm one nonfinancial balance read, monitor job result and fresh SMS. Unknown/PENDING is not a confirmed balance. GitHub Pages main publish state and installed Android test remain separate pending checks.

## 29. 2026-10-14 — Owner-corrected Mobilis balance method inference (DOCUMENTED, NOT IMPLEMENTED)

**Owner clarification:** The proposal is NOT to rename SIMs or change their persisted `sim_type` from PIN length. It is to choose the **balance inquiry method** for an independently confirmed Mobilis SIM: when the MSISDN starts with `06` and an existing stored service PIN has four digits, prefer Sama `*222#` (the inquiry itself is PIN-free); when the same prefix is accompanied by a five-digit service PIN, prefer Arsselli balance `*632*01*{service_pin}#` (PIN-bearing, only after server safety controls and explicit request confirmation). If no PIN/type evidence or contradictory signals exist, prompt the admin to establish the service type, **do not trial both methods**. A previously verified service type remains authoritative and must not be silently overwritten.

**Evidence:** Live aggregate Supabase check (no PIN values exported): 3 registered Sama SIMs with four-digit PINs and 2 Arsselli SIMs with five-digit PINs; all five phone numbers start `06`. Thus the `06` prefix *alone* does not discriminate and the combined heuristic is supported only for this observed cohort, not a proven universal provider contract. Source `station-connect/agent/src/balance.js` calls `*222#` without service PIN, while active Arsselli balance queue SQL uses `*632*01*{service_pin}#`. Existing `StationOverview.tsx` only receives `has_pin`, and backend queueing is keyed by persisted `sim_type`; selecting balance method by protected PIN length server-side would be a new reviewed/guarded change, **not active**.

**Safety rule pending implementation:** Once the network **confirms** a wrong service PIN, prevent PIN-bearing retries for at least 24 hours using an ICCID-bound, server-side cross-session lock, alert the admin and require a secure, audited reauthorization or verified corrected PIN per finalized policy. Unknown replies/timeouts must not automatically requeue; distinguish them from explicit PIN errors. No new live inquiry, PIN retrieval, type edit, schema update, or functional code change was authorized in this documentation-only step.

Full reference: `amordz72/developer/projects/flexy/MOBILIS-SIM-PIN-VALIDATION-AND-LOCKOUT-AUDIT-2026-10-14.md` §6.
