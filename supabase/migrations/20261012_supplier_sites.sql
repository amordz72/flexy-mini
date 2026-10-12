-- Flexy Mini supplier site registry. Configuration only; no remote code execution.
create table if not exists public.flexy_mini_supplier_sites (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 2 and 100),
 base_url text not null check (base_url ~ '^https://[^/[:space:]]+/?'),
 integration_kind text not null default 'manual' check (integration_kind in ('manual','api','station')),
 enabled boolean not null default false,
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (base_url)
);
alter table public.flexy_mini_supplier_sites enable row level security;
revoke all on public.flexy_mini_supplier_sites from anon;
grant select, insert, update on public.flexy_mini_supplier_sites to authenticated;
create policy flexy_mini_supplier_sites_admin_select on public.flexy_mini_supplier_sites for select to authenticated using (public.flexy_mini_is_admin());
create policy flexy_mini_supplier_sites_admin_insert on public.flexy_mini_supplier_sites for insert to authenticated with check (public.flexy_mini_is_admin());
create policy flexy_mini_supplier_sites_admin_update on public.flexy_mini_supplier_sites for update to authenticated using (public.flexy_mini_is_admin()) with check (public.flexy_mini_is_admin());
