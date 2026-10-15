-- Catalog display exceptions are scoped to a single Flexy Mini customer account.
-- A grant permits a hidden product (only its visible variants) or one hidden variant.
-- Frozen/inactive products and variants remain globally unavailable in the server filter.
-- No grants are inserted here: existing customer visibility remains unchanged.
create table if not exists public.flexy_mini_customer_catalog_grants (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.flexy_mini_customer_accounts(id) on delete restrict,
  product_id bigint references public.flexy_mini_products(id) on delete restrict,
  variant_id bigint references public.flexy_mini_variants(id) on delete restrict,
  granted_by uuid,
  created_at timestamptz not null default now(),
  constraint flexy_mini_catalog_grant_exact_target
    check ((product_id is not null) <> (variant_id is not null))
);
create unique index if not exists flexy_mini_customer_catalog_product_grant_uniq
  on public.flexy_mini_customer_catalog_grants(customer_id,product_id) where product_id is not null;
create unique index if not exists flexy_mini_customer_catalog_variant_grant_uniq
  on public.flexy_mini_customer_catalog_grants(customer_id,variant_id) where variant_id is not null;
create index if not exists flexy_mini_customer_catalog_grants_customer_idx
  on public.flexy_mini_customer_catalog_grants(customer_id);
alter table public.flexy_mini_customer_catalog_grants enable row level security;
revoke all on public.flexy_mini_customer_catalog_grants from public, anon, authenticated;
grant select,insert,delete on public.flexy_mini_customer_catalog_grants to service_role;
grant usage,select on sequence public.flexy_mini_customer_catalog_grants_id_seq to service_role;
comment on table public.flexy_mini_customer_catalog_grants is
 'Per-customer visibility exceptions; server-side checks still prohibit frozen or inactive stock. Service-role only, admin actions must authenticate.';
