-- Nahrávaný pitch (30 s až 3 min): nahrávka → prepis → tempo, pauzy, vypĺňacie slová,
-- obsahové skóre a reč tela. Pokus môže účastník zdieľať s mentorom akcie.

-- Poznámky k pitchu z onboardingu. Zobrazia sa nad kamerou počas nahrávania.
alter table public.profiles
  add column pitch_notes text
  constraint profiles_pitch_notes_length check (pitch_notes is null or char_length(pitch_notes) <= 4000);
grant update (pitch_notes) on public.profiles to authenticated;

-- Akcia (napr. Startup Weekend), ktorú vedie organizátor. Účastníci sa pripájajú kódom.
create table public.pitch_events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);
create index pitch_events_organizer_idx on public.pitch_events (organizer_id, created_at desc);

create table public.pitch_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  audience text not null check (audience in ('investor', 'team')),
  target_seconds integer not null check (target_seconds in (30, 60, 180)),
  focus text not null default 'tempo' check (focus in ('tempo', 'fillery', 'obsah')),
  with_camera boolean not null default false,
  duration_ms integer check (duration_ms >= 0),
  status text not null default 'analyzing' check (status in ('analyzing', 'ready', 'failed')),
  transcript text check (char_length(transcript) <= 20000),
  -- Tvar `PitchMetrics` (src/lib/pitch/metrics.ts): tempo, pauzy, vypĺňacie slová, slová s časmi.
  metrics jsonb check (metrics is null or jsonb_typeof(metrics) = 'object'),
  -- Tvar `ContentScore` (src/lib/pitch/content.ts): 5 kategórií 0–10 s radou.
  content jsonb check (content is null or jsonb_typeof(content) = 'object'),
  content_score numeric(3, 1) check (content_score between 0 and 10),
  -- Tvar `BodySummary` (src/lib/pitch/body.ts). Iba odvodené hodnoty, nikdy obraz.
  body jsonb check (body is null or jsonb_typeof(body) = 'object'),
  model text check (char_length(model) <= 80),
  -- Zdieľanie s mentorom akcie (vyplní účastník až pri zdieľaní).
  event_id uuid references public.pitch_events (id) on delete set null,
  share_name text check (char_length(share_name) between 1 and 80),
  share_team text check (char_length(share_team) between 1 and 80),
  share_email text check (char_length(share_email) between 3 and 254),
  shared_at timestamptz,
  created_at timestamptz not null default now()
);
create index pitch_attempts_user_idx on public.pitch_attempts (user_id, created_at desc);
create index pitch_attempts_event_idx on public.pitch_attempts (event_id, created_at) where event_id is not null;

alter table public.pitch_events enable row level security;
alter table public.pitch_attempts enable row level security;
revoke all on table public.pitch_events, public.pitch_attempts from anon, authenticated;
grant select, insert, update, delete on table public.pitch_events, public.pitch_attempts to service_role;

-- Organizátor vidí a spravuje iba svoje akcie. Zápisy idú cez server (service_role).
grant select on public.pitch_events to authenticated;
create policy pitch_events_select_own on public.pitch_events
  for select to authenticated using (organizer_id = (select auth.uid()));

-- Účastník vidí a maže svoje pokusy. Mentor vidí pokusy zdieľané do jeho akcie.
grant select, delete on public.pitch_attempts to authenticated;
create policy pitch_attempts_select_own on public.pitch_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy pitch_attempts_select_mentor on public.pitch_attempts
  for select to authenticated using (
    shared_at is not null
    and event_id in (select id from public.pitch_events where organizer_id = (select auth.uid()))
  );
create policy pitch_attempts_delete_own on public.pitch_attempts
  for delete to authenticated using (user_id = (select auth.uid()));
