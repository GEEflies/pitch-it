-- Pitch It: zápisy na early access.
-- Spusti v Supabase (SQL Editor) alebo cez `supabase db push`.

create table if not exists public.early_access_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  stage text not null
    check (stage in ('idea', 'pre_seed', 'seed', 'series_a_plus')),
  next_meeting text
    check (next_meeting in ('within_2_weeks', 'within_3_months', 'not_planned')),
  consent_version text not null check (char_length(consent_version) <= 32),
  consent_at timestamptz not null default now(),
  -- HMAC-SHA256 IP adresy (hex). Samotnú IP neukladáme.
  ip_hash text check (ip_hash is null or char_length(ip_hash) = 64),
  utm_source text check (utm_source is null or char_length(utm_source) <= 100),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 100),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 100),
  created_at timestamptz not null default now()
);

comment on table public.early_access_signups is
  'Zápisy na early access z landing page. Prístup iba cez serverový secret kľúč.';

-- Jeden zápis na e-mail bez ohľadu na veľkosť písmen.
create unique index if not exists early_access_signups_email_key
  on public.early_access_signups (lower(email));

-- Rýchly počet zápisov z jedného zdroja za poslednú hodinu (rate limit).
create index if not exists early_access_signups_ip_recent_idx
  on public.early_access_signups (ip_hash, created_at desc)
  where ip_hash is not null;

-- RLS bez politík: anon ani authenticated nemajú k tabuľke žiadny prístup.
-- Server používa secret (service_role) kľúč, ktorý RLS obchádza.
alter table public.early_access_signups enable row level security;
revoke all on table public.early_access_signups from anon, authenticated;
grant select, insert, update, delete on table public.early_access_signups to service_role;

-- Minimalizácia údajov: hash IP po 24 hodinách odstraňujeme.
-- Beží pri každom novom zápise, takže netreba pg_cron.
create or replace function public.purge_stale_early_access_ip_hashes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.early_access_signups
     set ip_hash = null
   where ip_hash is not null
     and created_at < now() - interval '24 hours';
  return null;
end;
$$;

revoke all on function public.purge_stale_early_access_ip_hashes() from public, anon, authenticated;

drop trigger if exists early_access_signups_purge_ip on public.early_access_signups;
create trigger early_access_signups_purge_ip
  after insert on public.early_access_signups
  for each statement
  execute function public.purge_stale_early_access_ip_hashes();
