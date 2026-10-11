-- Flexy Mini only. REVIEW and apply in Supabase after permission checks.
-- No changes to MyTool users, login, or existing Master rows.
create table if not exists public.flexy_mini_members (
 id bigint generated always as identity primary key,
 party_id bigint not null unique references public.money_party_directory(id),
 role text not null default 'viewer' check (role in ('viewer','seller','manager')),
 active boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.flexy_mini_permissions (
 member_id bigint not null references public.flexy_mini_members(id) on delete cascade,
 permission text not null check (permission in ('cards.view','cards.sell','cards.manage','wallet.view','wallet.manage','stations.view','stations.manage','users.manage')),
 allowed boolean not null default false,
 primary key(member_id,permission)
);
alter table public.flexy_mini_members enable row level security;
alter table public.flexy_mini_permissions enable row level security;
revoke all on public.flexy_mini_members, public.flexy_mini_permissions from anon;
grant select,insert,update,delete on public.flexy_mini_members, public.flexy_mini_permissions to authenticated;
grant usage,select on sequence public.flexy_mini_members_id_seq to authenticated;
create policy "flexy mini admin manages members" on public.flexy_mini_members for all to authenticated using ((select private.is_shop_admin())) with check ((select private.is_shop_admin()));
create policy "flexy mini admin manages permissions" on public.flexy_mini_permissions for all to authenticated using ((select private.is_shop_admin())) with check ((select private.is_shop_admin()));
-- These policies allow owner management ONLY. Worker PIN login and server authorization
-- must be implemented separately; Master membership does not create an app session.
