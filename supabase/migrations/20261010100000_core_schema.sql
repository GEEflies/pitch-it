-- Pitch It: hlavná schéma aplikácie.
-- Závisí od Supabase schém `auth` a `storage`. Spusti po migrácii early access.
--
-- Pravidlá prístupu:
--   * RLS je zapnuté na každej tabuľke, rola anon nemá prístup k ničomu.
--   * Obsah používateľa zapisuje server klientom s reláciou používateľa (RLS platí).
--   * Systémové údaje (stav relácie, merania, reporty, limity, predplatné, udalosti)
--     môže používateľ iba čítať; zapisuje ich server cez service_role.

-- ─────────────────────────────────────────────────────────────────────────────
-- Pomocné funkcie
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Používatelia
-- ─────────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  locale text not null default 'sk' check (locale in ('sk', 'en')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_mode text not null default 'coach'
    check (default_mode in ('coach', 'simulation', 'delivery')),
  coach_focus text[] not null default array['pace', 'answer_length']::text[]
    check (coach_focus <@ array['pace', 'answer_length', 'fillers', 'camera_gaze', 'framing']::text[]),
  -- NULL = uchovávať, kým to používateľ nezmaže.
  data_retention_days integer check (data_retention_days in (30, 90, 365)),
  updated_at timestamptz not null default now()
);

-- Súhlasy sú append-only log. Aktuálny stav je posledný záznam pre daný druh.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'terms', 'privacy_notice', 'age_18', 'microphone_processing',
    'camera_analysis', 'audio_recording', 'product_emails'
  )),
  granted boolean not null,
  version text not null check (char_length(version) between 1 and 32),
  created_at timestamptz not null default now()
);

create index consents_user_kind_idx on public.consents (user_id, kind, created_at desc);

create view public.current_consents
with (security_invoker = true) as
select distinct on (user_id, kind) user_id, kind, granted, version, created_at
from public.consents
order by user_id, kind, created_at desc;

-- Pri registrácii: profil, nastavenia, free plán a súhlasy z registračného formulára
-- (posielajú sa v raw_user_meta_data, lebo pred potvrdením e-mailu nie je relácia).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  consent_version text := left(coalesce(meta ->> 'consent_version', 'unknown'), 32);
  name text := nullif(btrim(left(coalesce(meta ->> 'display_name', ''), 80)), '');
begin
  insert into public.profiles (id, display_name) values (new.id, name);
  insert into public.user_settings (user_id) values (new.id);
  insert into public.subscriptions (user_id) values (new.id);

  if (meta ->> 'accepted_terms') = 'true' then
    insert into public.consents (user_id, kind, granted, version)
    values (new.id, 'terms', true, consent_version),
           (new.id, 'privacy_notice', true, consent_version);
  end if;
  if (meta ->> 'age_confirmed') = 'true' then
    insert into public.consents (user_id, kind, granted, version)
    values (new.id, 'age_18', true, consent_version);
  end if;
  if (meta ->> 'product_emails') = 'true' then
    insert into public.consents (user_id, kind, granted, version)
    values (new.id, 'product_emails', true, consent_version);
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Projekty a tím
-- ─────────────────────────────────────────────────────────────────────────────

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  one_liner text check (char_length(one_liner) <= 400),
  industry text check (char_length(industry) <= 120),
  problem text check (char_length(problem) <= 4000),
  solution text check (char_length(solution) <= 4000),
  target_segment text check (char_length(target_segment) <= 4000),
  business_model text check (char_length(business_model) <= 4000),
  competition text check (char_length(competition) <= 4000),
  differentiation text check (char_length(differentiation) <= 4000),
  traction text check (char_length(traction) <= 4000),
  financials text check (char_length(financials) <= 4000),
  team text check (char_length(team) <= 4000),
  stage text not null default 'pre_seed'
    check (stage in ('idea', 'pre_seed', 'seed', 'series_a', 'series_b_plus')),
  raise_amount numeric(14, 2) check (raise_amount is null or raise_amount >= 0),
  raise_currency text not null default 'EUR' check (raise_currency in ('EUR', 'USD', 'CZK', 'GBP')),
  use_of_funds text check (char_length(use_of_funds) <= 4000),
  meeting_goal text check (char_length(meeting_goal) <= 1000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id, updated_at desc);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

-- Rola aktuálneho používateľa v projekte: owner | editor | viewer | NULL.
-- security definer, aby sa politiky projects a project_members navzájom nevolali rekurzívne.
create or replace function public.project_role(p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.projects p
      where p.id = p_project_id and p.owner_id = (select auth.uid())
    ) then 'owner'
    else (
      select m.role from public.project_members m
      where m.project_id = p_project_id and m.user_id = (select auth.uid())
    )
  end
$$;

create or replace function public.can_read_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.project_role(p_project_id) is not null
$$;

create or replace function public.can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.project_role(p_project_id) in ('owner', 'editor'), false)
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Podklady
-- ─────────────────────────────────────────────────────────────────────────────

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 512),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_type text not null check (file_type in ('pdf', 'pptx')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 26214400),
  sha256 text not null check (char_length(sha256) = 64),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'extracting', 'analyzing', 'ready', 'failed')),
  slide_count integer check (slide_count >= 0),
  error_code text check (char_length(error_code) <= 64),
  analysis_summary text check (char_length(analysis_summary) <= 4000),
  analysis_model text check (char_length(analysis_model) <= 80),
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_project_idx on public.documents (project_id, created_at desc);
-- Rovnaký súbor v jednom projekte nahráme iba raz.
create unique index documents_project_sha_key on public.documents (project_id, sha256);

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  slide_number integer not null check (slide_number > 0),
  title text check (char_length(title) <= 300),
  body text not null default '' check (char_length(body) <= 20000),
  notes text check (char_length(notes) <= 20000),
  method text not null check (method in ('pdf_text', 'pptx_xml')),
  created_at timestamptz not null default now(),
  unique (document_id, slide_number)
);

create index document_extractions_project_idx on public.document_extractions (project_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fakty, metriky a problémy v podkladoch
-- ─────────────────────────────────────────────────────────────────────────────

create table public.startup_facts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  category text not null check (category in (
    'market', 'traction', 'financials', 'unit_economics', 'team', 'product',
    'technology', 'competition', 'business_model', 'fundraising', 'other'
  )),
  label text not null check (char_length(label) between 1 and 160),
  value_text text not null check (char_length(value_text) between 1 and 2000),
  value_number numeric,
  unit text check (char_length(unit) <= 24),
  period text check (char_length(period) <= 60),
  -- user: zadal používateľ; document: doslova v podklade; ai_inference: interpretácia AI.
  source_type text not null check (source_type in ('user', 'document', 'ai_inference')),
  status text not null check (status in ('confirmed', 'needs_review', 'rejected')),
  confidence text check (confidence in ('low', 'medium', 'high')),
  document_id uuid references public.documents (id) on delete set null,
  slide_number integer check (slide_number > 0),
  source_quote text check (char_length(source_quote) <= 1000),
  note text check (char_length(note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Údaj od používateľa je potvrdený z definície. Extrakcia a AI začínajú na revízii.
  constraint startup_facts_user_confirmed check (source_type <> 'user' or status = 'confirmed')
);

create index startup_facts_project_idx on public.startup_facts (project_id, category);

create table public.project_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('missing', 'conflict', 'unsupported_claim', 'unclear')),
  category text check (category in (
    'market', 'traction', 'financials', 'unit_economics', 'team', 'product',
    'technology', 'competition', 'business_model', 'fundraising', 'other'
  )),
  description text not null check (char_length(description) between 1 and 1000),
  document_id uuid references public.documents (id) on delete cascade,
  slide_number integer check (slide_number > 0),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index project_issues_project_idx on public.project_issues (project_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cvičenia (pred reláciami, lebo relácia môže patriť cvičeniu)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  source_session_id uuid, -- FK sa pridá po vytvorení training_sessions
  category text not null check (category in (
    'market', 'financials', 'competition', 'traction_unit_economics', 'team',
    'fundraising_ask', 'concise_answers', 'tough_follow_ups', 'full_pitch'
  )),
  kind text not null check (kind in ('answer_drill', 'mini_simulation', 'pitch_timed')),
  title text not null check (char_length(title) between 1 and 160),
  prompt text not null check (char_length(prompt) between 1 and 2000),
  rationale text check (char_length(rationale) <= 2000),
  original_excerpt text check (char_length(original_excerpt) <= 4000),
  success_criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(success_criteria) = 'array'),
  time_limit_seconds integer check (time_limit_seconds between 15 and 1800),
  origin text not null check (origin in ('report', 'library')),
  status text not null default 'open' check (status in ('open', 'completed', 'dismissed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercises_user_idx on public.exercises (user_id, status, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Tréningové relácie
-- ─────────────────────────────────────────────────────────────────────────────

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  mode text not null check (mode in ('coach', 'simulation', 'delivery')),
  investor_key text not null check (char_length(investor_key) between 1 and 40),
  scenario_key text not null check (char_length(scenario_key) between 1 and 40),
  exercise_id uuid references public.exercises (id) on delete set null,
  previous_session_id uuid references public.training_sessions (id) on delete set null,
  language text not null default 'sk' check (language in ('sk', 'en')),
  transport text not null default 'realtime' check (transport in ('realtime', 'text')),
  status text not null default 'ready'
    check (status in ('ready', 'live', 'completed', 'abandoned', 'failed')),
  camera_enabled boolean not null default false,
  coach_focus text[] not null default '{}'::text[],
  target_duration_seconds integer not null check (target_duration_seconds between 60 and 3600),
  realtime_provider text check (char_length(realtime_provider) <= 40),
  realtime_model text check (char_length(realtime_model) <= 80),
  config_snapshot jsonb not null default '{}'::jsonb,
  -- Spotreba tokenov podľa poskytovateľa (meranie reálnych nákladov na minútu).
  provider_usage jsonb not null default '{}'::jsonb,
  connection_count integer not null default 0 check (connection_count >= 0),
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  ended_at timestamptz,
  billed_seconds integer not null default 0 check (billed_seconds >= 0),
  end_reason text check (end_reason in (
    'user_ended', 'investor_ended', 'time_limit', 'connection_lost', 'error', 'abandoned'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index training_sessions_user_idx on public.training_sessions (user_id, created_at desc);
create index training_sessions_project_idx on public.training_sessions (project_id, created_at desc);
create index training_sessions_live_idx on public.training_sessions (user_id) where status = 'live';

alter table public.exercises
  add constraint exercises_source_session_fkey
  foreign key (source_session_id) references public.training_sessions (id) on delete set null;

create table public.conversation_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seq integer not null check (seq >= 0),
  speaker text not null check (speaker in ('investor', 'founder')),
  text text not null check (char_length(text) <= 20000),
  -- Posun od začiatku relácie v ms.
  started_ms integer check (started_ms >= 0),
  ended_ms integer check (ended_ms is null or started_ms is null or ended_ms >= started_ms),
  interrupted boolean not null default false,
  source text not null check (source in ('realtime', 'text')),
  provider_item_id text check (char_length(provider_item_id) <= 100),
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

create table public.audio_delivery_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  turn_seq integer not null check (turn_seq >= 0),
  speech_ms integer not null check (speech_ms >= 0),
  word_count integer not null check (word_count >= 0),
  words_per_minute numeric(6, 1),
  response_latency_ms integer check (response_latency_ms >= 0),
  pause_count integer not null default 0 check (pause_count >= 0),
  pause_total_ms integer not null default 0 check (pause_total_ms >= 0),
  longest_pause_ms integer not null default 0 check (longest_pause_ms >= 0),
  filler_count integer not null default 0 check (filler_count >= 0),
  fillers jsonb not null default '{}'::jsonb,
  -- Orientačné signály z mikrofónu (spracované v prehliadači).
  volume_variability numeric(6, 3),
  pitch_variability_semitones numeric(6, 2),
  pitch_reliable boolean not null default false,
  -- Priemerná pravdepodobnosť tokenov prepisu (0 až 1), ak ju poskytovateľ vráti.
  transcript_confidence numeric(4, 3) check (transcript_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (session_id, turn_seq)
);

-- Iba agregované signály z kamery. Žiadne snímky ani landmarky.
create table public.visual_analytics (
  session_id uuid primary key references public.training_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  frames_analyzed integer not null check (frames_analyzed >= 0),
  sample_rate_hz numeric(4, 1),
  face_visible_ratio numeric(4, 3),
  face_centered_ratio numeric(4, 3),
  facing_camera_ratio numeric(4, 3),
  gaze_toward_camera_ratio numeric(4, 3),
  head_movement_index numeric(6, 3),
  upper_body_visible_ratio numeric(4, 3),
  posture_stability_index numeric(6, 3),
  hands_visible_ratio numeric(4, 3),
  gesture_activity_index numeric(6, 3),
  framing_issues text[] not null default '{}'::text[],
  per_turn jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.feedback_reports (
  session_id uuid primary key references public.training_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'ready', 'failed', 'insufficient_data', 'not_configured')),
  measured jsonb not null default '{}'::jsonb,
  assessment jsonb,
  model text check (char_length(model) <= 80),
  prompt_version text check (char_length(prompt_version) <= 40),
  error_code text check (char_length(error_code) <= 64),
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answer_text text not null check (char_length(answer_text) between 1 and 20000),
  input_method text not null check (input_method in ('voice', 'text')),
  duration_ms integer check (duration_ms >= 0),
  word_count integer check (word_count >= 0),
  words_per_minute numeric(6, 1),
  filler_count integer check (filler_count >= 0),
  evaluation jsonb,
  evaluation_status text not null default 'pending'
    check (evaluation_status in ('pending', 'ready', 'failed', 'not_configured')),
  model text check (char_length(model) <= 80),
  created_at timestamptz not null default now()
);

create index exercise_attempts_exercise_idx on public.exercise_attempts (exercise_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Predplatné, spotreba, produktové udalosti
-- ─────────────────────────────────────────────────────────────────────────────

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  provider text check (provider in ('stripe')),
  provider_customer_id text unique check (char_length(provider_customer_id) <= 100),
  provider_subscription_id text unique check (char_length(provider_subscription_id) <= 100),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Spotreba sa pri zmazaní relácie zachová (set null), aby sa limit nedal obísť mazaním.
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'realtime_seconds', 'text_turn', 'report', 'deck_analysis',
    'exercise_evaluation', 'hint', 'transcription_seconds'
  )),
  quantity integer not null check (quantity >= 0),
  session_id uuid references public.training_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index usage_events_user_kind_time_idx on public.usage_events (user_id, kind, created_at desc);

-- Po zmazaní účtu sa user_id nastaví na NULL: udalosti obsahujú iba vymenované hodnoty, nie obsah.
create table public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (name in (
    'signup_completed', 'onboarding_completed', 'project_created', 'deck_processed',
    'session_started', 'session_completed', 'report_viewed', 'session_repeated',
    'exercise_completed', 'checkout_started', 'purchase_completed', 'account_deleted'
  )),
  properties jsonb not null default '{}'::jsonb check (pg_column_size(properties) < 2048),
  created_at timestamptz not null default now()
);

create index product_events_name_time_idx on public.product_events (name, created_at desc);

-- Trigger pre auth.users musí ísť až po vytvorení subscriptions.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at
-- ─────────────────────────────────────────────────────────────────────────────

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger startup_facts_updated_at before update on public.startup_facts
  for each row execute function public.set_updated_at();
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();
create trigger training_sessions_updated_at before update on public.training_sessions
  for each row execute function public.set_updated_at();
create trigger feedback_reports_updated_at before update on public.feedback_reports
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Práva a RLS
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'consents', 'projects', 'project_members',
    'documents', 'document_extractions', 'startup_facts', 'project_issues',
    'exercises', 'training_sessions', 'conversation_turns', 'audio_delivery_metrics',
    'visual_analytics', 'feedback_reports', 'exercise_attempts', 'subscriptions',
    'usage_events', 'product_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end;
$$;

grant usage on sequence public.product_events_id_seq to service_role;
revoke all on public.current_consents from anon;
grant select on public.current_consents to authenticated, service_role;

-- profiles: čítať a meniť iba vlastný profil, iba vybrané stĺpce.
grant select on public.profiles to authenticated;
grant update (display_name, locale, onboarding_completed_at) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- user_settings
grant select on public.user_settings to authenticated;
grant update (default_mode, coach_focus, data_retention_days) on public.user_settings to authenticated;
create policy user_settings_select_own on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_settings_update_own on public.user_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- consents: append-only, iba vlastné.
grant select, insert on public.consents to authenticated;
create policy consents_select_own on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert_own on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

-- projects
grant select, insert, delete on public.projects to authenticated;
grant update (
  name, one_liner, industry, problem, solution, target_segment, business_model,
  competition, differentiation, traction, financials, team, stage, raise_amount,
  raise_currency, use_of_funds, meeting_goal, archived_at
) on public.projects to authenticated;
-- Priama kontrola vlastníka je nutná pre `insert … returning`: funkcia so snapshotom
-- začiatku príkazu nový riadok ešte nevidí.
create policy projects_select_member on public.projects
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.can_read_project(id));
create policy projects_insert_owner on public.projects
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy projects_update_editor on public.projects
  for update to authenticated using (public.can_edit_project(id)) with check (public.can_edit_project(id));
create policy projects_delete_owner on public.projects
  for delete to authenticated using (owner_id = (select auth.uid()));

-- project_members: vidia členovia, spravuje iba vlastník projektu.
grant select, insert, update, delete on public.project_members to authenticated;
create policy project_members_select on public.project_members
  for select to authenticated using (public.can_read_project(project_id));
create policy project_members_owner_write on public.project_members
  for all to authenticated
  using (public.project_role(project_id) = 'owner')
  with check (public.project_role(project_id) = 'owner' and user_id <> (select auth.uid()));

-- documents: čítajú členovia, nahrávajú a mažú editori. Stav spracovania mení server.
grant select, insert, delete on public.documents to authenticated;
create policy documents_select on public.documents
  for select to authenticated using (public.can_read_project(project_id));
create policy documents_insert on public.documents
  for insert to authenticated
  with check (public.can_edit_project(project_id) and uploaded_by = (select auth.uid()) and status = 'uploaded');
create policy documents_delete on public.documents
  for delete to authenticated using (public.can_edit_project(project_id));

-- document_extractions: iba čítanie, zapisuje server.
grant select on public.document_extractions to authenticated;
create policy document_extractions_select on public.document_extractions
  for select to authenticated using (public.can_read_project(project_id));

-- startup_facts a project_issues: editori môžu všetko v rámci projektu.
grant select, insert, update, delete on public.startup_facts to authenticated;
create policy startup_facts_select on public.startup_facts
  for select to authenticated using (public.can_read_project(project_id));
create policy startup_facts_write on public.startup_facts
  for all to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

grant select, insert, update, delete on public.project_issues to authenticated;
create policy project_issues_select on public.project_issues
  for select to authenticated using (public.can_read_project(project_id));
create policy project_issues_write on public.project_issues
  for all to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

-- training_sessions: vlastník číta a môže zmazať. Životný cyklus a účtovanie riadi server.
grant select, delete on public.training_sessions to authenticated;
create policy training_sessions_select_own on public.training_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy training_sessions_delete_own on public.training_sessions
  for delete to authenticated using (user_id = (select auth.uid()) and status <> 'live');

-- conversation_turns: čítať vlastné, pridávať iba do vlastnej živej relácie.
grant select, insert on public.conversation_turns to authenticated;
create policy conversation_turns_select_own on public.conversation_turns
  for select to authenticated using (user_id = (select auth.uid()));
create policy conversation_turns_insert_live on public.conversation_turns
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.training_sessions s
      where s.id = session_id and s.user_id = (select auth.uid()) and s.status = 'live'
    )
  );

-- Merania, reporty, vizuálne agregáty: iba čítanie vlastných.
grant select on public.audio_delivery_metrics to authenticated;
create policy audio_delivery_metrics_select_own on public.audio_delivery_metrics
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.visual_analytics to authenticated;
create policy visual_analytics_select_own on public.visual_analytics
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.feedback_reports to authenticated;
create policy feedback_reports_select_own on public.feedback_reports
  for select to authenticated using (user_id = (select auth.uid()));

-- exercises: používateľ ich vidí, mení stav a maže. Vytvára ich server (z reportu alebo knižnice).
grant select, delete on public.exercises to authenticated;
grant update (status, completed_at) on public.exercises to authenticated;
create policy exercises_select_own on public.exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy exercises_update_own on public.exercises
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercises_delete_own on public.exercises
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.exercise_attempts to authenticated;
create policy exercise_attempts_select_own on public.exercise_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy exercise_attempts_delete_own on public.exercise_attempts
  for delete to authenticated using (user_id = (select auth.uid()));

-- Predplatné a spotreba: iba čítanie. Udalosti: bez prístupu.
grant select on public.subscriptions to authenticated;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.usage_events to authenticated;
create policy usage_events_select_own on public.usage_events
  for select to authenticated using (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Funkcie pre server (iba service_role)
-- ─────────────────────────────────────────────────────────────────────────────

-- Uzavrie relácie bez signálu dlhšie ako p_stale_after a vyúčtuje ich do posledného signálu.
create or replace function public.close_stale_sessions(p_user_id uuid, p_stale_after interval default interval '2 minutes')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed integer := 0;
  s record;
  seconds integer;
begin
  for s in
    select id, started_at, last_heartbeat_at, target_duration_seconds, billed_seconds
    from public.training_sessions
    where user_id = p_user_id
      and status = 'live'
      and coalesce(last_heartbeat_at, started_at, created_at) < now() - p_stale_after
    for update
  loop
    seconds := least(
      greatest(0, floor(extract(epoch from (coalesce(s.last_heartbeat_at, s.started_at) - s.started_at)))::integer),
      s.target_duration_seconds + 120
    );
    update public.training_sessions
       set status = 'abandoned', end_reason = 'abandoned', ended_at = coalesce(s.last_heartbeat_at, now()),
           billed_seconds = seconds
     where id = s.id;
    if seconds > s.billed_seconds then
      insert into public.usage_events (user_id, kind, quantity, session_id)
      values (p_user_id, 'realtime_seconds', seconds - s.billed_seconds, s.id);
    end if;
    closed := closed + 1;
  end loop;
  return closed;
end;
$$;

-- Zmaže relácie staršie, než si používateľ nastavil. Spúšťa sa plánovane (pg_cron), pozri README.
create or replace function public.purge_expired_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.training_sessions s
  using public.user_settings us
  where us.user_id = s.user_id
    and us.data_retention_days is not null
    and s.status <> 'live'
    and s.created_at < now() - make_interval(days => us.data_retention_days);
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function public.close_stale_sessions(uuid, interval) from public, anon, authenticated;
revoke all on function public.purge_expired_sessions() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.close_stale_sessions(uuid, interval) to service_role;
grant execute on function public.purge_expired_sessions() to service_role;
grant execute on function public.project_role(uuid) to authenticated, service_role;
grant execute on function public.can_read_project(uuid) to authenticated, service_role;
grant execute on function public.can_edit_project(uuid) to authenticated, service_role;
revoke execute on function public.project_role(uuid) from public, anon;
revoke execute on function public.can_read_project(uuid) from public, anon;
revoke execute on function public.can_edit_project(uuid) from public, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- Úložisko podkladov: súkromný bucket, cesta {project_id}/{document_id}.{ext}
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pitch-documents', 'pitch-documents', false, 26214400,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Prvý segment cesty ako uuid projektu, alebo NULL pri neplatnom tvare.
create or replace function public.storage_project_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  if first_segment ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return first_segment::uuid;
  end if;
  return null;
end;
$$;

grant execute on function public.storage_project_id(text) to authenticated, service_role;

create policy pitch_documents_select on storage.objects
  for select to authenticated
  using (bucket_id = 'pitch-documents' and public.can_read_project(public.storage_project_id(name)));
create policy pitch_documents_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pitch-documents' and public.can_edit_project(public.storage_project_id(name)));
create policy pitch_documents_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'pitch-documents' and public.can_edit_project(public.storage_project_id(name)));
