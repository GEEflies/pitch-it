-- Typ účtu z registrácie: účastník (zakladateľ, ktorý trénuje) alebo organizátor
-- (mentor akcie, vidí prehľad tímov). Nastavuje sa len pri vytvorení účtu.
alter table public.profiles
  add column account_type text not null default 'participant'
  constraint profiles_account_type_check check (account_type in ('participant', 'organizer'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  consent_version text := left(coalesce(meta ->> 'consent_version', 'unknown'), 32);
  name text := nullif(btrim(left(coalesce(meta ->> 'display_name', meta ->> 'full_name', ''), 80)), '');
  kind text := case when (meta ->> 'account_type') = 'organizer' then 'organizer' else 'participant' end;
begin
  insert into public.profiles (id, display_name, account_type) values (new.id, name, kind);
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
