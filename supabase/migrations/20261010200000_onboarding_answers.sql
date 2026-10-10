-- Odpovede z úvodného kvízu (/app/vitaj). Personalizujú plán tréningu a predvolený
-- prvý tréning. Používateľ ich smie meniť iba vo vlastnom profile.
alter table public.profiles
  add column onboarding_answers jsonb
  constraint profiles_onboarding_answers_object check (
    onboarding_answers is null
    or (jsonb_typeof(onboarding_answers) = 'object' and pg_column_size(onboarding_answers) <= 4096)
  );

grant update (onboarding_answers) on public.profiles to authenticated;
