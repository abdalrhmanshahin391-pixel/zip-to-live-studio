begin;
-- FILE: 20260904144534_0e8f89e6-145d-495b-a423-81698926504b.sql
-- ============ roles ============
create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles read own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

create policy "roles read own" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admins read roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============ personal study kit ============
create table public.study_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
create index study_state_user_idx on public.study_state (user_id);
grant select, insert, update, delete on public.study_state to authenticated;
grant all on public.study_state to service_role;
alter table public.study_state enable row level security;
create policy "study own" on public.study_state for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger study_state_updated_at before update on public.study_state
  for each row execute function public.set_updated_at();

-- ============ classes ============
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);
create table public.class_decks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  subtopic text not null,
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index class_members_user_idx on public.class_members (user_id);
create index class_decks_class_idx on public.class_decks (class_id);

grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.class_members to authenticated;
grant select, insert, update, delete on public.class_decks to authenticated;
grant all on public.classes to service_role;
grant all on public.class_members to service_role;
grant all on public.class_decks to service_role;

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_decks enable row level security;

create or replace function public.is_class_member(_class_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_members where class_id = _class_id and user_id = _user_id
  ) or exists (
    select 1 from public.classes where id = _class_id and owner_id = _user_id
  )
$$;

create policy "classes read member" on public.classes for select to authenticated
  using (public.is_class_member(id, auth.uid()));
create policy "classes create" on public.classes for insert to authenticated
  with check (auth.uid() = owner_id);
create policy "classes owner update" on public.classes for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "classes owner delete" on public.classes for delete to authenticated
  using (auth.uid() = owner_id);

create policy "members read" on public.class_members for select to authenticated
  using (public.is_class_member(class_id, auth.uid()));
create policy "members join self" on public.class_members for insert to authenticated
  with check (auth.uid() = user_id);
create policy "members leave self" on public.class_members for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));

create policy "class decks read" on public.class_decks for select to authenticated
  using (public.is_class_member(class_id, auth.uid()));
create policy "class decks share" on public.class_decks for insert to authenticated
  with check (auth.uid() = user_id and public.is_class_member(class_id, auth.uid()));
create policy "class decks update own" on public.class_decks for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "class decks delete own" on public.class_decks for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()));

create trigger classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create trigger class_decks_updated_at before update on public.class_decks
  for each row execute function public.set_updated_at();

-- ============ RitaX announcements ============
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled announcement',
  status text not null default 'draft',
  layout text not null default 'modal',
  theme text not null default 'cream',
  accent text,
  eyebrow text,
  title text not null default '',
  body text,
  image_url text,
  emoji text,
  confetti boolean not null default false,
  countdown_to timestamptz,
  primary_label text,
  primary_href text,
  secondary_label text,
  secondary_href text,
  audience text not null default 'all',
  pages jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  frequency text not null default 'once',
  priority integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "announcements read live" on public.announcements for select to anon, authenticated
  using (status = 'live');
create policy "announcements admin read" on public.announcements for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "announcements admin write" on public.announcements for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.announcement_events (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  kind text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index announcement_events_idx on public.announcement_events (announcement_id, kind);
grant insert on public.announcement_events to anon, authenticated;
grant select on public.announcement_events to authenticated;
grant all on public.announcement_events to service_role;
alter table public.announcement_events enable row level security;
create policy "events insert" on public.announcement_events for insert to anon, authenticated with check (true);
create policy "events admin read" on public.announcement_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
-- FILE: 20260904144557_8e28ad78-9853-4b20-b940-ba195d406a89.sql
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_class_member(uuid, uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_class_member(uuid, uuid) to authenticated, service_role;
-- FILE: 20260904144614_b58ecabf-c199-496e-9d8f-3b2a2386cf0d.sql
create or replace function public.grant_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'klory.shaheen3@icloud.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.grant_owner_admin() from public, anon, authenticated;

create trigger on_auth_user_created_owner_admin
  after insert on auth.users
  for each row execute function public.grant_owner_admin();

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'klory.shaheen3@icloud.com'
on conflict (user_id, role) do nothing;
-- FILE: 20260904144647_e51f4104-d85e-4a2e-81eb-eaa5855af34b.sql
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists username text,
  add column if not exists email text,
  add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
begin
  meta_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1));
  insert into public.profiles (id, display_name, full_name, username, email, phone, avatar_url)
  values (
    new.id,
    meta_name,
    meta_name,
    coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    new.phone,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
-- FILE: 20260904144813_acb96ad8-cfb2-4421-81bb-0997a6b8b10d.sql
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now()
);
grant select on public.courses to anon, authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "courses readable" on public.courses for select using (true);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
grant select on public.subjects to anon, authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "subjects readable" on public.subjects for select using (true);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  question_id uuid,
  snippet_html text not null default '',
  snippet_text text not null default '',
  user_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create policy "own notes select" on public.notes for select to authenticated using (auth.uid() = user_id);
create policy "own notes insert" on public.notes for insert to authenticated with check (auth.uid() = user_id);
create policy "own notes update" on public.notes for update to authenticated using (auth.uid() = user_id);
create policy "own notes delete" on public.notes for delete to authenticated using (auth.uid() = user_id);
create index if not exists notes_user_idx on public.notes(user_id, created_at desc);
-- FILE: 20260904145936_398a1b4e-b665-44b1-be8b-60749195d679.sql
CREATE TABLE public.card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  sub_subject text NOT NULL DEFAULT '',
  ease numeric NOT NULL DEFAULT 2.5,
  difficulty numeric,
  stability numeric,
  interval_days numeric NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  step integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'new',
  suspended boolean NOT NULL DEFAULT false,
  leech boolean NOT NULL DEFAULT false,
  last_grade integer,
  last_review_at timestamptz,
  due_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);
CREATE INDEX card_reviews_due_idx ON public.card_reviews(user_id, due_at);
CREATE INDEX card_reviews_subject_idx ON public.card_reviews(user_id, subject);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_reviews TO authenticated;
GRANT ALL ON public.card_reviews TO service_role;
ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own card reviews" ON public.card_reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER card_reviews_touch BEFORE UPDATE ON public.card_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  grade integer NOT NULL,
  ms integer NOT NULL DEFAULT 0,
  elapsed_days numeric,
  prev jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_events_user_idx ON public.review_events(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_events TO authenticated;
GRANT ALL ON public.review_events TO service_role;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own review events" ON public.review_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  cards integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  ms integer NOT NULL DEFAULT 0,
  goal_met boolean NOT NULL DEFAULT false,
  frozen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_days TO authenticated;
GRANT ALL ON public.study_days TO service_role;
ALTER TABLE public.study_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study days" ON public.study_days FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER study_days_touch BEFORE UPDATE ON public.study_days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.study_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_goal integer NOT NULL DEFAULT 20,
  retention numeric NOT NULL DEFAULT 0.9,
  new_per_day integer NOT NULL DEFAULT 12,
  review_cap integer NOT NULL DEFAULT 150,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_prefs TO authenticated;
GRANT ALL ON public.study_prefs TO service_role;
ALTER TABLE public.study_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study prefs" ON public.study_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER study_prefs_touch BEFORE UPDATE ON public.study_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.card_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  sub_subject text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_flags TO authenticated;
GRANT ALL ON public.card_flags TO service_role;
ALTER TABLE public.card_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own card flags" ON public.card_flags FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER card_flags_touch BEFORE UPDATE ON public.card_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- FILE: 20260904155106_bf0e005d-6c97-42dc-9f8e-300e46c76eb3.sql
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

alter table public.profiles add column if not exists display_name text;

alter table public.card_reviews
  add column if not exists difficulty numeric,
  add column if not exists stability numeric,
  add column if not exists step integer not null default 0,
  add column if not exists suspended boolean not null default false,
  add column if not exists last_review_at timestamptz;

alter table public.review_events
  add column if not exists sub_subject text not null default '',
  add column if not exists elapsed_days numeric,
  add column if not exists prev jsonb;

alter table public.study_prefs
  add column if not exists retention numeric not null default 0.9,
  add column if not exists new_per_day integer not null default 12,
  add column if not exists review_cap integer not null default 150;

create table if not exists public.study_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
grant select, insert, update, delete on public.study_state to authenticated;
grant all on public.study_state to service_role;
alter table public.study_state enable row level security;
drop policy if exists "study own" on public.study_state;
create policy "study own" on public.study_state for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists study_state_updated_at on public.study_state;
create trigger study_state_updated_at before update on public.study_state
  for each row execute function public.set_updated_at();

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);
create table if not exists public.class_decks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  subtopic text not null,
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.classes, public.class_members, public.class_decks to authenticated;
grant all on public.classes, public.class_members, public.class_decks to service_role;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_decks enable row level security;

create or replace function public.is_class_member(_class_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = _class_id and user_id = _user_id)
      or exists (select 1 from public.classes where id = _class_id and owner_id = _user_id)
$$;
revoke all on function public.is_class_member(uuid, uuid) from public, anon;
grant execute on function public.is_class_member(uuid, uuid) to authenticated, service_role;

drop policy if exists "classes create" on public.classes;
create policy "classes create" on public.classes for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "classes read member" on public.classes;
create policy "classes read member" on public.classes for select to authenticated using (public.is_class_member(id, auth.uid()));
drop policy if exists "classes owner update" on public.classes;
create policy "classes owner update" on public.classes for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "classes owner delete" on public.classes;
create policy "classes owner delete" on public.classes for delete to authenticated using (auth.uid() = owner_id);

drop policy if exists "members join self" on public.class_members;
create policy "members join self" on public.class_members for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "members read" on public.class_members;
create policy "members read" on public.class_members for select to authenticated using (public.is_class_member(class_id, auth.uid()));
drop policy if exists "members leave self" on public.class_members;
create policy "members leave self" on public.class_members for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_members.class_id and c.owner_id = auth.uid()));

drop policy if exists "class decks read" on public.class_decks;
create policy "class decks read" on public.class_decks for select to authenticated using (public.is_class_member(class_id, auth.uid()));
drop policy if exists "class decks share" on public.class_decks;
create policy "class decks share" on public.class_decks for insert to authenticated
  with check (auth.uid() = user_id and public.is_class_member(class_id, auth.uid()));
drop policy if exists "class decks update own" on public.class_decks;
create policy "class decks update own" on public.class_decks for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "class decks delete own" on public.class_decks;
create policy "class decks delete own" on public.class_decks for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.classes c where c.id = class_decks.class_id and c.owner_id = auth.uid()));

drop trigger if exists classes_updated_at on public.classes;
create trigger classes_updated_at before update on public.classes for each row execute function public.set_updated_at();
drop trigger if exists class_decks_updated_at on public.class_decks;
create trigger class_decks_updated_at before update on public.class_decks for each row execute function public.set_updated_at();

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled announcement',
  status text not null default 'draft',
  layout text not null default 'modal',
  theme text not null default 'cream',
  accent text,
  eyebrow text,
  title text not null default '',
  body text,
  image_url text,
  emoji text,
  confetti boolean not null default false,
  countdown_to timestamptz,
  primary_label text,
  primary_href text,
  secondary_label text,
  secondary_href text,
  audience text not null default 'all',
  pages jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  frequency text not null default 'once',
  priority integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.announcement_events (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  kind text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
grant insert on public.announcement_events to anon, authenticated;
grant select on public.announcement_events to authenticated;
grant all on public.announcement_events to service_role;
alter table public.announcements enable row level security;
alter table public.announcement_events enable row level security;
drop policy if exists "announcements read live" on public.announcements;
create policy "announcements read live" on public.announcements for select to anon, authenticated using (status = 'live');
drop policy if exists "announcements admin read" on public.announcements;
create policy "announcements admin read" on public.announcements for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "announcements admin write" on public.announcements;
create policy "announcements admin write" on public.announcements for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "events insert" on public.announcement_events;
create policy "events insert" on public.announcement_events for insert to anon, authenticated with check (true);
drop policy if exists "events admin read" on public.announcement_events;
create policy "events admin read" on public.announcement_events for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();

create or replace function public.grant_owner_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.email,'')) = 'klory.shaheen3@icloud.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.grant_owner_admin() from public, anon, authenticated;
drop trigger if exists grant_owner_admin_trigger on public.profiles;
create trigger grant_owner_admin_trigger after insert on public.profiles
  for each row execute function public.grant_owner_admin();
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from public.profiles where lower(email) = 'klory.shaheen3@icloud.com'
on conflict (user_id, role) do nothing;
-- FILE: 20260904155204_753f5177-3e19-4d83-94e4-e7acb83c192d.sql
revoke all on function public.admin_users_with_plans() from anon;
revoke all on function public.effective_plan(uuid) from anon;
-- FILE: 20260904155410_6afe0547-dca3-447a-8b67-0042dfed4256.sql
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.relname);
    execute format('grant all on public.%I to service_role', t.relname);
    if exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.relname
        and p.cmd in ('SELECT','ALL')
        and (p.roles @> array['public']::name[] or p.roles @> array['anon']::name[])
    ) then
      execute format('grant select on public.%I to anon', t.relname);
    end if;
  end loop;
end $$;
grant usage on all sequences in schema public to authenticated;
grant all on all sequences in schema public to service_role;
-- FILE: 20260905122331_486d6648-8a44-4d3b-9ac0-ace3716976e0.sql
CREATE OR REPLACE FUNCTION public.ensure_lq_default_bucket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _subject_id uuid;
  _subtopic_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Please sign in again.'; END IF;

  SELECT id INTO _subject_id
  FROM public.lq_subjects
  WHERE user_id = _uid AND lower(btrim(name)) = 'my lectures'
  ORDER BY created_at
  LIMIT 1;

  IF _subject_id IS NULL THEN
    INSERT INTO public.lq_subjects (user_id, name)
    VALUES (_uid, 'My lectures')
    RETURNING id INTO _subject_id;
  END IF;

  SELECT id INTO _subtopic_id
  FROM public.lq_subtopics
  WHERE user_id = _uid AND subject_id = _subject_id AND lower(btrim(name)) = 'general'
  ORDER BY created_at
  LIMIT 1;

  IF _subtopic_id IS NULL THEN
    INSERT INTO public.lq_subtopics (user_id, subject_id, name)
    VALUES (_uid, _subject_id, 'General')
    RETURNING id INTO _subtopic_id;
  END IF;

  RETURN jsonb_build_object('subjectId', _subject_id, 'subtopicId', _subtopic_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_lq_default_bucket() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_lq_default_bucket() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_lq_generation(
  _subtopic_id uuid,
  _title text,
  _source_name text,
  _difficulty text,
  _key_points jsonb,
  _questions jsonb,
  _lecture_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _saved_lecture_id uuid;
  _question jsonb;
  _index integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Please sign in again.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lq_subtopics
    WHERE id = _subtopic_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'That sub-subject is not available in your account.';
  END IF;
  IF jsonb_typeof(_questions) <> 'array' OR jsonb_array_length(_questions) = 0 THEN
    RAISE EXCEPTION 'No valid questions were generated.';
  END IF;

  IF _lecture_id IS NULL THEN
    INSERT INTO public.lq_lectures (
      user_id, subtopic_id, title, source_name, difficulty, key_points, question_count
    ) VALUES (
      _uid, _subtopic_id, btrim(_title), NULLIF(btrim(COALESCE(_source_name, '')), ''),
      _difficulty, COALESCE(_key_points, '[]'::jsonb), jsonb_array_length(_questions)
    ) RETURNING id INTO _saved_lecture_id;
  ELSE
    SELECT id INTO _saved_lecture_id
    FROM public.lq_lectures
    WHERE id = _lecture_id AND user_id = _uid
    FOR UPDATE;
    IF _saved_lecture_id IS NULL THEN RAISE EXCEPTION 'That lecture is not available in your account.'; END IF;

    DELETE FROM public.lq_questions WHERE lecture_id = _saved_lecture_id AND user_id = _uid;
    UPDATE public.lq_lectures
    SET title = btrim(_title),
        source_name = NULLIF(btrim(COALESCE(_source_name, '')), ''),
        difficulty = _difficulty,
        key_points = COALESCE(_key_points, '[]'::jsonb),
        question_count = jsonb_array_length(_questions)
    WHERE id = _saved_lecture_id AND user_id = _uid;
  END IF;

  FOR _question IN SELECT value FROM jsonb_array_elements(_questions)
  LOOP
    INSERT INTO public.lq_questions (
      user_id, lecture_id, stem, options, explanation, point_ref, sort_order
    ) VALUES (
      _uid,
      _saved_lecture_id,
      btrim(_question->>'stem'),
      COALESCE(_question->'options', '[]'::jsonb),
      COALESCE(_question->>'explanation', ''),
      NULLIF(btrim(COALESCE(_question->>'point_ref', '')), ''),
      _index
    );
    _index := _index + 1;
  END LOOP;

  RETURN _saved_lecture_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_lq_generation(uuid, text, text, text, jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_lq_generation(uuid, text, text, text, jsonb, jsonb, uuid) TO authenticated;
-- FILE: 20260905150100_7bdcaefd-5578-4781-bc99-0e806b0a1ab6.sql
ALTER TABLE public.lq_subjects ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.lq_subtopics ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "read example lq_subjects" ON public.lq_subjects;
CREATE POLICY "read example lq_subjects" ON public.lq_subjects
  FOR SELECT TO authenticated USING (is_example = true);

DROP POLICY IF EXISTS "read example lq_subtopics" ON public.lq_subtopics;
CREATE POLICY "read example lq_subtopics" ON public.lq_subtopics
  FOR SELECT TO authenticated USING (is_example = true);

-- Clean up the old per-account sample shelf.
DELETE FROM public.lq_subjects WHERE name LIKE '%(sample)%' AND is_example = false;

-- Shared example shelf, owned by a fixed system id.
DELETE FROM public.lq_subjects WHERE user_id = '00000000-0000-4000-8000-000000000001';

INSERT INTO public.lq_subjects (id, user_id, name, sort_order, is_example) VALUES
  ('a0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Physiology (example)',1,true),
  ('a0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Anatomy (example)',2,true),
  ('a0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Pharmacology (example)',3,true),
  ('a0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','Pathology (example)',4,true),
  ('a0000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','Biochemistry (example)',5,true),
  ('a0000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','Microbiology (example)',6,true);

INSERT INTO public.lq_subtopics (id, user_id, subject_id, name, sort_order, is_example) VALUES
  ('b0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Cardiac cycle',1,true),
  ('b0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Respiratory volumes',2,true),
  ('b0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Renal filtration',3,true),
  ('b0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','Upper limb',1,true),
  ('b0000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','Thorax',2,true),
  ('b0000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Antibiotics',1,true),
  ('b0000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Autonomic drugs',2,true),
  ('b0000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','Inflammation',1,true),
  ('b0000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','Neoplasia',2,true),
  ('b0000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','Glycolysis',1,true),
  ('b0000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','Vitamins',2,true),
  ('b0000000-0000-4000-8000-00000000000c','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','Gram-positive cocci',1,true),
  ('b0000000-0000-4000-8000-00000000000d','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','Viral hepatitis',2,true);

INSERT INTO public.lq_lectures (id, user_id, subtopic_id, title, source_name, difficulty, key_points, question_count, is_example) VALUES
  ('c0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','The cardiac cycle (example lecture)','Example lecture','mixed','["Systole vs diastole","Valve events and heart sounds","Preload and afterload"]'::jsonb,3,true),
  ('c0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000006','Beta-lactam antibiotics (example lecture)','Example lecture','mixed','["Cell wall synthesis","Beta-lactamase resistance","Common side effects"]'::jsonb,3,true);

INSERT INTO public.lq_questions (user_id, lecture_id, stem, options, explanation, point_ref, sort_order) VALUES
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Which valves close at the start of ventricular systole, producing the first heart sound?','[{"letter":"A","body":"Aortic and pulmonary valves","is_correct":false},{"letter":"B","body":"Mitral and tricuspid valves","is_correct":true},{"letter":"C","body":"Aortic valve only","is_correct":false},{"letter":"D","body":"Tricuspid valve only","is_correct":false}]'::jsonb,'S1 is the closure of the atrioventricular valves as ventricular pressure rises above atrial pressure. The semilunar valves close later, at the end of systole, giving S2.','Valve events and heart sounds',1),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','During which phase is coronary blood flow to the left ventricle highest?','[{"letter":"A","body":"Isovolumetric contraction","is_correct":false},{"letter":"B","body":"Rapid ejection","is_correct":false},{"letter":"C","body":"Diastole","is_correct":true},{"letter":"D","body":"Atrial systole","is_correct":false}]'::jsonb,'Intramural vessels are compressed during systole, so left coronary perfusion happens mainly in diastole. Tachycardia shortens diastole and reduces coronary filling time.','Systole vs diastole',2),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Increasing venous return raises stroke volume mainly by increasing which factor?','[{"letter":"A","body":"Preload","is_correct":true},{"letter":"B","body":"Afterload","is_correct":false},{"letter":"C","body":"Heart rate","is_correct":false},{"letter":"D","body":"Contractility","is_correct":false}]'::jsonb,'More venous return stretches the ventricle, so end-diastolic volume (preload) rises and stroke volume follows the Frank-Starling relationship.','Preload and afterload',3),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','What is the mechanism of action of penicillins?','[{"letter":"A","body":"Inhibit the 50S ribosomal subunit","is_correct":false},{"letter":"B","body":"Inhibit cell wall cross-linking by binding transpeptidases","is_correct":true},{"letter":"C","body":"Inhibit DNA gyrase","is_correct":false},{"letter":"D","body":"Disrupt folate synthesis","is_correct":false}]'::jsonb,'Beta-lactams bind penicillin-binding proteins (transpeptidases) and block peptidoglycan cross-linking, so growing bacteria lyse. They are bactericidal and need actively dividing cells.','Cell wall synthesis',1),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','Adding clavulanic acid to amoxicillin helps because it:','[{"letter":"A","body":"Blocks beta-lactamase enzymes","is_correct":true},{"letter":"B","body":"Improves oral absorption","is_correct":false},{"letter":"C","body":"Widens ribosomal binding","is_correct":false},{"letter":"D","body":"Slows renal clearance","is_correct":false}]'::jsonb,'Clavulanic acid is a suicide inhibitor of beta-lactamase, protecting amoxicillin from enzymatic breakdown and restoring activity against resistant organisms.','Beta-lactamase resistance',2),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','Which reaction is the classic serious adverse effect of penicillins?','[{"letter":"A","body":"Tendon rupture","is_correct":false},{"letter":"B","body":"Immediate IgE-mediated anaphylaxis","is_correct":true},{"letter":"C","body":"Grey baby syndrome","is_correct":false},{"letter":"D","body":"Ototoxicity","is_correct":false}]'::jsonb,'Type I hypersensitivity to the beta-lactam ring can cause urticaria, bronchospasm and anaphylaxis within minutes. Always ask about the nature of a reported penicillin allergy.','Common side effects',3);
-- FILE: 20260905154347_d53385ac-f9ea-45b0-945b-274c7d138fa0.sql
CREATE POLICY "View questions in free subjects" ON public.questions FOR SELECT TO authenticated USING (
  owner_user_id IS NULL AND EXISTS (
    SELECT 1 FROM public.subjects s
    JOIN public.subject_groups sg ON sg.id = s.group_id
    JOIN public.courses c ON c.id = sg.course_id
    WHERE s.id = questions.subject_id
      AND s.owner_user_id IS NULL
      AND s.access_level IN ('free_public','free_logged_in')
      AND c.published = true
  )
);

CREATE POLICY "View options in free subjects" ON public.question_options FOR SELECT TO authenticated USING (
  owner_user_id IS NULL AND EXISTS (
    SELECT 1 FROM public.questions q
    JOIN public.subjects s ON s.id = q.subject_id
    JOIN public.subject_groups sg ON sg.id = s.group_id
    JOIN public.courses c ON c.id = sg.course_id
    WHERE q.id = question_options.question_id
      AND s.owner_user_id IS NULL
      AND s.access_level IN ('free_public','free_logged_in')
      AND c.published = true
  )
);

CREATE POLICY "Users can join free courses" ON public.user_courses FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = user_courses.course_id
      AND c.published = true
      AND c.admin_only = false
      AND COALESCE(c.price, 0) <= 0
  )
);
-- FILE: 20260905160828_ce43a68a-13ad-4f04-9246-e2b582bd19f9.sql
-- Faster per-account lookups
CREATE INDEX IF NOT EXISTS study_subjects_user_idx ON public.study_subjects (user_id);
CREATE INDEX IF NOT EXISTS study_topics_user_idx ON public.study_topics (user_id);
CREATE INDEX IF NOT EXISTS shared_decks_owner_idx ON public.shared_decks (owner_id);
CREATE INDEX IF NOT EXISTS flash_subjects_user_idx ON public.flash_subjects (user_id);
CREATE INDEX IF NOT EXISTS card_reviews_user_due_idx ON public.card_reviews (user_id, due_at);

-- Helper checks used by public-facing reads
GRANT EXECUTE ON FUNCTION public.can_manage_committee(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.event_visible(uuid) TO anon;
-- FILE: 20260905161944_b54de2bc-cc33-423c-823d-72da7e1b9241.sql
ALTER TABLE public.shared_decks
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';

ALTER TABLE public.shared_decks
  DROP CONSTRAINT IF EXISTS shared_decks_audience_check;
ALTER TABLE public.shared_decks
  ADD CONSTRAINT shared_decks_audience_check CHECK (audience IN ('public','space'));

CREATE INDEX IF NOT EXISTS shared_decks_audience_idx ON public.shared_decks (audience, created_at DESC);

CREATE OR REPLACE FUNCTION public.deck_in_my_space(_deck_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_decks sd
    JOIN public.space_members sm
      ON sm.space_id = sd.space_id AND sm.user_id = _user_id
    WHERE sd.deck_id = _deck_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.deck_in_my_space(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "space members read space decks" ON public.shared_decks;
CREATE POLICY "space members read space decks"
  ON public.shared_decks FOR SELECT TO authenticated
  USING (public.deck_in_my_space(id, auth.uid()));

DROP POLICY IF EXISTS "space members read space deck cards" ON public.shared_deck_cards;
CREATE POLICY "space members read space deck cards"
  ON public.shared_deck_cards FOR SELECT TO authenticated
  USING (public.deck_in_my_space(deck_id, auth.uid()));
-- FILE: 20260905221543_63f95a4f-6232-48e8-a82f-0992e88a4a9c.sql
-- 1. Emails must never be reachable by anonymous callers
revoke all on function public.get_email_by_username(text) from anon, authenticated;

-- 2. Privileged / internal helpers should not be callable by anonymous visitors
revoke all on function public.admin_users_with_plans() from anon;
revoke all on function public.effective_plan(uuid) from anon;
revoke all on function public.deck_in_my_space(uuid, uuid) from anon;

-- 3. Migration bookkeeping table locked down
alter table public._mig_log enable row level security;
revoke all on table public._mig_log from anon, authenticated;
grant all on table public._mig_log to service_role;
drop policy if exists "mig log admins only" on public._mig_log;
create policy "mig log admins only" on public._mig_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 4. Plans: keep a single clear public read rule
drop policy if exists "Plans are public" on public.plans;
drop policy if exists "Plans are publicly readable" on public.plans;

-- 5. Public profiles: signed-in users can browse them; anonymous visitors only
--    see the authors of decks that are actually published publicly.
drop policy if exists "public profiles are readable" on public.public_profiles;
drop policy if exists "profiles readable by members" on public.public_profiles;
drop policy if exists "profiles of public deck authors" on public.public_profiles;
create policy "profiles readable by members" on public.public_profiles
  for select to authenticated using (true);
create policy "profiles of public deck authors" on public.public_profiles
  for select to anon using (
    exists (
      select 1 from public.shared_decks d
      where d.owner_id = public_profiles.id
        and d.published = true
        and d.audience = 'public'
    )
  );

-- 6. Private key for the scheduled background workers (admin-only table)
insert into public.site_secrets (key, value, updated_at)
values ('worker_cron_key', '9e08bf71d985ff9c65cf8b31a35fc82162b873c6', now())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 7. Sharing stays opt-in
alter table public.summaries alter column is_public set default false;
-- FILE: 20260905221638_d37e5c79-678b-4b2d-a93c-d52e86111d39.sql
-- Private helpers: remove the implicit "anyone may run this" grant
revoke execute on function public.get_email_by_username(text) from public, anon, authenticated;
revoke execute on function public.admin_users_with_plans() from public, anon;
revoke execute on function public.can_manage_committee(uuid) from public, anon;
revoke execute on function public.deck_in_my_space(uuid, uuid) from public, anon;
revoke execute on function public.effective_plan(uuid) from public, anon;

-- Leftover migration-replay helpers: fixed search path
alter function zz.replay() set search_path = public;
alter function zz.replay(text, text) set search_path = public;
alter function zz.replay_stmts() set search_path = public;
-- FILE: 20260905224741_96aa769c-c88d-41c6-91c5-114cdd1eb4f1.sql
ALTER TABLE public.admin_ai_keys ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'shared';

ALTER TABLE public.admin_ai_keys DROP CONSTRAINT IF EXISTS admin_ai_keys_pkey;
ALTER TABLE public.admin_ai_keys DROP CONSTRAINT IF EXISTS admin_ai_keys_provider_slot_key;

ALTER TABLE public.admin_ai_keys
  ADD CONSTRAINT admin_ai_keys_provider_slot_purpose_key UNIQUE (provider, slot, purpose);

ALTER TABLE public.admin_ai_keys
  ADD CONSTRAINT admin_ai_keys_purpose_check
  CHECK (purpose IN ('shared','aio','rita','lecture','questions'));
-- FILE: 20260906214341_efb31f00-14ac-43b4-85f9-e37995119da9.sql
CREATE TABLE public.site_feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  badge TEXT,
  badge_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_feature_flags TO anon;
GRANT SELECT ON public.site_feature_flags TO authenticated;
GRANT ALL ON public.site_feature_flags TO service_role;

ALTER TABLE public.site_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON public.site_feature_flags FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage feature flags"
  ON public.site_feature_flags FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_feature_flags_touch
  BEFORE UPDATE ON public.site_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- FILE: 20260906231619_a4f45e66-e45c-4c53-b527-54f67f9120f5.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tour_seen_at timestamptz;
-- FILE: 20260907133728_c46cc509-71d1-4ee5-a6ed-bd622d99dd1e.sql
CREATE TABLE public.slide_decks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT,
  subject_label TEXT,
  subtopic_label TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  pages_done INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'building',
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slide_decks TO authenticated;
GRANT ALL ON public.slide_decks TO service_role;

ALTER TABLE public.slide_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own slide decks"
ON public.slide_decks FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX slide_decks_user_created_idx ON public.slide_decks (user_id, created_at DESC);

CREATE TRIGGER slide_decks_updated_at
BEFORE UPDATE ON public.slide_decks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- FILE: 20260907144756_af13965d-dd64-476e-8018-90c7c6b5c5aa.sql
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS credit_packs_enabled boolean NOT NULL DEFAULT false;
-- FILE: 20260907170945_cf0892cb-d26c-476a-a44a-faaa763972c7.sql
UPDATE public.plans SET paddle_price_monthly='toolkit_monthly', paddle_price_yearly='toolkit_yearly' WHERE slug='toolkit';
UPDATE public.plans SET paddle_price_monthly='boost_monthly', paddle_price_yearly='boost_yearly' WHERE slug='boost';
UPDATE public.plans SET paddle_price_monthly='pro_monthly', paddle_price_yearly='pro_yearly' WHERE slug='pro';
UPDATE public.plans SET paddle_price_monthly='ultimate_monthly', paddle_price_yearly='ultimate_yearly' WHERE slug='ultimate';
-- FILE: 20260907190357_2f9a441b-bebb-4bd1-bba5-b14fe1d641fd.sql
-- old lecture-lab leftovers: keep the tables (live feature), clear the old rows
DELETE FROM public.lq_attempts;
DELETE FROM public.lq_questions;
DELETE FROM public.lq_lectures;
DELETE FROM public.lq_subtopics;
DELETE FROM public.lq_subjects;

-- groups no longer reference the removed packages feature
ALTER TABLE public.user_groups DROP COLUMN IF EXISTS package_id;

-- functions that only served the removed features
DROP FUNCTION IF EXISTS public.can_manage_committee(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_committee_members(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_committee_years(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_committee_subject(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.committee_team_add CASCADE;
DROP FUNCTION IF EXISTS public.committee_team_list CASCADE;
DROP FUNCTION IF EXISTS public.committee_team_remove CASCADE;
DROP FUNCTION IF EXISTS public.log_committee_change CASCADE;
DROP FUNCTION IF EXISTS public.set_committee_qr CASCADE;
DROP FUNCTION IF EXISTS public.head_list_committee_members CASCADE;
DROP FUNCTION IF EXISTS public.head_set_committee_role CASCADE;
DROP FUNCTION IF EXISTS public.admin_list_committee_members CASCADE;
DROP FUNCTION IF EXISTS public.admin_grant_committee_role CASCADE;
DROP FUNCTION IF EXISTS public.admin_revoke_committee_role CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_events CASCADE;
DROP FUNCTION IF EXISTS public.event_visible CASCADE;
DROP FUNCTION IF EXISTS public.apply_coupon CASCADE;
DROP FUNCTION IF EXISTS public.validate_coupon CASCADE;
DROP FUNCTION IF EXISTS public.university_id_by_slug CASCADE;
DROP FUNCTION IF EXISTS public.is_class_member CASCADE;
DROP FUNCTION IF EXISTS public.ensure_lq_default_bucket CASCADE;
DROP FUNCTION IF EXISTS public.user_owns_lecture_course CASCADE;

-- committee library
DROP TABLE IF EXISTS public.committee_best_sources CASCADE;
DROP TABLE IF EXISTS public.committee_subject_courses CASCADE;
DROP TABLE IF EXISTS public.committee_resources CASCADE;
DROP TABLE IF EXISTS public.committee_categories CASCADE;
DROP TABLE IF EXISTS public.committee_subjects CASCADE;
DROP TABLE IF EXISTS public.committee_modules CASCADE;
DROP TABLE IF EXISTS public.committee_semesters CASCADE;
DROP TABLE IF EXISTS public.committee_years CASCADE;
DROP TABLE IF EXISTS public.committee_members CASCADE;
DROP TABLE IF EXISTS public.committee_activity_log CASCADE;

-- events
DROP TABLE IF EXISTS public.event_contacts CASCADE;
DROP TABLE IF EXISTS public.event_members CASCADE;
DROP TABLE IF EXISTS public.event_sections CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;

-- mentor
DROP TABLE IF EXISTS public.mentor_task_completions CASCADE;
DROP TABLE IF EXISTS public.mentor_tasks CASCADE;
DROP TABLE IF EXISTS public.mentor_journal CASCADE;
DROP TABLE IF EXISTS public.mentor_treasures CASCADE;
DROP TABLE IF EXISTS public.mentor_entries CASCADE;
DROP TABLE IF EXISTS public.mentor_categories CASCADE;

-- shop leftovers
DROP TABLE IF EXISTS public.package_purchases CASCADE;
DROP TABLE IF EXISTS public.package_courses CASCADE;
DROP TABLE IF EXISTS public.packages CASCADE;
DROP TABLE IF EXISTS public.coupon_redemptions CASCADE;
DROP TABLE IF EXISTS public.coupon_courses CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.course_options CASCADE;

-- universities / leads
DROP TABLE IF EXISTS public.university_tiles CASCADE;
DROP TABLE IF EXISTS public.universities_settings CASCADE;
DROP TABLE IF EXISTS public.universities CASCADE;
DROP TABLE IF EXISTS public.institution_leads CASCADE;

-- old lecture pages / quizzes / rebuilds
DROP TABLE IF EXISTS public.lecture_quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.lecture_quiz_options CASCADE;
DROP TABLE IF EXISTS public.lecture_quiz_questions CASCADE;
DROP TABLE IF EXISTS public.lecture_quizzes CASCADE;
DROP TABLE IF EXISTS public.lecture_items CASCADE;
DROP TABLE IF EXISTS public.lecture_subjects CASCADE;
DROP TABLE IF EXISTS public.lecture_rebuild_pages CASCADE;
DROP TABLE IF EXISTS public.lecture_rebuilds CASCADE;

-- old batch / iPad tools
DROP TABLE IF EXISTS public.jarvis_batch_german_ipad_chunks CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_german_ipad_jobs CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_ipad_chunks CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_ipad_jobs CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_chunks CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_jobs CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_jobs CASCADE;
DROP TABLE IF EXISTS public.aquavision_items CASCADE;
DROP TABLE IF EXISTS public.aquavision_pages CASCADE;
DROP TABLE IF EXISTS public.aquavision_jobs CASCADE;
DROP TABLE IF EXISTS public.patch_prox_items CASCADE;
DROP TABLE IF EXISTS public.patch_prox_pages CASCADE;
DROP TABLE IF EXISTS public.patch_prox_jobs CASCADE;
DROP TABLE IF EXISTS public.sonic_chunks CASCADE;
DROP TABLE IF EXISTS public.sonic_jobs CASCADE;
DROP TABLE IF EXISTS public.sonic_pdfs CASCADE;

-- other unused leftovers
DROP TABLE IF EXISTS public.site_blocks CASCADE;
DROP TABLE IF EXISTS public.study_plan_subjects CASCADE;
DROP TABLE IF EXISTS public.study_plan_stages CASCADE;
DROP TABLE IF EXISTS public.study_topics CASCADE;
DROP TABLE IF EXISTS public.study_subjects CASCADE;
DROP TABLE IF EXISTS public.class_decks CASCADE;
DROP TABLE IF EXISTS public.class_members CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.space_moderation_log CASCADE;
DROP TABLE IF EXISTS public.ad_creatives CASCADE;
DROP TABLE IF EXISTS public.question_gen_batches CASCADE;
DROP TABLE IF EXISTS public.guides CASCADE;
-- FILE: 20260907231305_3697fb3c-7442-4144-a9b0-3f9a2731239c.sql
DROP TABLE IF EXISTS public.slide_decks CASCADE;
DROP TABLE IF EXISTS public.study_focus_sessions CASCADE;
DROP TABLE IF EXISTS public.vault_runs CASCADE;
-- FILE: 20260908004434_77e72b5f-f1f3-47f7-9f46-4adefbb5776a.sql
-- 1. Retire the look & content tools
DROP TABLE IF EXISTS public.site_blocks CASCADE;
DROP TABLE IF EXISTS public.site_sections CASCADE;
DROP TABLE IF EXISTS public.site_pages CASCADE;
DROP TABLE IF EXISTS public.site_nav_items CASCADE;
DROP TABLE IF EXISTS public.site_content CASCADE;
DROP TABLE IF EXISTS public.about_blocks CASCADE;
DROP TABLE IF EXISTS public.site_feature_flags CASCADE;

-- 2. People directory, now with plan + kit
DROP FUNCTION IF EXISTS public.admin_people_directory();

CREATE OR REPLACE FUNCTION public.admin_people_directory()
RETURNS TABLE(
  id uuid, full_name text, username text, email text, phone text,
  verified boolean, locked_at timestamptz, lock_until timestamptz, lock_reason text,
  roles text[], courses bigint, paid_cents bigint,
  created_at timestamptz, last_seen timestamptz, login_count bigint,
  plan_slug text, plan_name text,
  kit_slug text, kit_name text, kit_expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT u.id,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', ''),
    COALESCE(p.username, u.raw_user_meta_data->>'username', split_part(u.email::text,'@',1)),
    COALESCE(p.email, u.email::text),
    COALESCE(p.phone, u.phone::text),
    (u.email_confirmed_at IS NOT NULL),
    p.locked_at, p.lock_until, p.lock_reason,
    COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id), ARRAY[]::text[]),
    (SELECT count(*) FROM public.user_courses uc WHERE uc.user_id = u.id)::bigint,
    COALESCE((SELECT sum(pe.amount_cents) FROM public.payment_events pe
              WHERE pe.user_id = u.id AND pe.status = 'completed'), 0)::bigint,
    u.created_at,
    GREATEST(
      (SELECT max(s.last_seen_at) FROM public.user_sessions s WHERE s.user_id = u.id),
      (SELECT max(e.occurred_at) FROM public.user_login_events e WHERE e.user_id = u.id)
    ),
    (SELECT count(*) FROM public.user_login_events e WHERE e.user_id = u.id)::bigint,
    COALESCE(up.plan_slug, 'starter'),
    COALESCE(pl.name, 'Starter'),
    tk.slug, tk.name, tc.expires_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_plans up ON up.user_id = u.id
  LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
  LEFT JOIN LATERAL (
    SELECT c.expires_at, c.code_id
    FROM public.toolkit_claims c
    WHERE c.user_id = u.id
    ORDER BY c.expires_at DESC NULLS LAST
    LIMIT 1
  ) tc ON true
  LEFT JOIN LATERAL (
    SELECT pl2.slug, pl2.name
    FROM public.toolkit_codes tcode
    JOIN public.plans pl2 ON pl2.slug = tcode.plan_slug
    WHERE tcode.id = tc.code_id
  ) tk ON true
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_people_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people_directory() TO authenticated;

-- 3. Live pulse
CREATE OR REPLACE FUNCTION public.admin_people_pulse()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'online_now', (SELECT count(*) FROM public.user_sessions s WHERE s.last_seen_at > now() - interval '5 minutes'),
    'online_15m', (SELECT count(*) FROM public.user_sessions s WHERE s.last_seen_at > now() - interval '15 minutes'),
    'opened_today', (SELECT count(DISTINCT s.user_id) FROM public.user_sessions s WHERE s.last_seen_at >= date_trunc('day', now())),
    'opened_yesterday', (SELECT count(DISTINCT e.user_id) FROM public.user_login_events e
                         WHERE e.occurred_at >= date_trunc('day', now()) - interval '1 day'
                           AND e.occurred_at < date_trunc('day', now())),
    'total_users', (SELECT count(*) FROM auth.users),
    'hourly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('hour', h, 'logins', c) ORDER BY h)
      FROM (
        SELECT g.h AS h,
          (SELECT count(*) FROM public.user_login_events e
           WHERE e.occurred_at >= date_trunc('day', now()) + (g.h || ' hours')::interval
             AND e.occurred_at <  date_trunc('day', now()) + ((g.h + 1) || ' hours')::interval) AS c
        FROM generate_series(0, 23) AS g(h)
      ) q
    ), '[]'::jsonb),
    'plan_mix', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'people', people) ORDER BY people DESC)
      FROM (
        SELECT COALESCE(up.plan_slug, 'starter') AS slug,
               COALESCE(pl.name, 'Starter') AS name,
               count(*)::bigint AS people
        FROM auth.users u
        LEFT JOIN public.user_plans up ON up.user_id = u.id
        LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
        GROUP BY 1, 2
      ) m
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_people_pulse() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people_pulse() TO authenticated;

-- 4. Who is online right now
CREATE OR REPLACE FUNCTION public.admin_people_online()
RETURNS TABLE(
  user_id uuid, full_name text, username text, email text,
  plan_slug text, plan_name text,
  started_at timestamptz, last_seen_at timestamptz, minutes_active integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT s.user_id,
    COALESCE(p.full_name, ''),
    COALESCE(p.username, split_part(COALESCE(p.email, ''), '@', 1)),
    p.email,
    COALESCE(up.plan_slug, 'starter'),
    COALESCE(pl.name, 'Starter'),
    s.started_at,
    s.last_seen_at,
    GREATEST(1, (EXTRACT(EPOCH FROM (s.last_seen_at - s.started_at)) / 60)::int)
  FROM public.user_sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.user_plans up ON up.user_id = s.user_id
  LEFT JOIN public.plans pl ON pl.slug = COALESCE(up.plan_slug, 'starter')
  WHERE s.last_seen_at > now() - interval '15 minutes'
  ORDER BY s.last_seen_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_people_online() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people_online() TO authenticated;

-- 5. One person's history
CREATE OR REPLACE FUNCTION public.admin_person_history(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'plan_slug', COALESCE((SELECT up.plan_slug FROM public.user_plans up WHERE up.user_id = _user_id), 'starter'),
    'plan_changed_at', (SELECT up.updated_at FROM public.user_plans up WHERE up.user_id = _user_id),
    'logins', COALESCE((SELECT jsonb_agg(x.occurred_at ORDER BY x.occurred_at DESC)
                        FROM (SELECT e.occurred_at FROM public.user_login_events e
                              WHERE e.user_id = _user_id
                              ORDER BY e.occurred_at DESC LIMIT 40) x), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'id', d.id, 'platform', d.platform,
                            'user_agent', d.user_agent, 'last_seen_at', d.last_seen_at))
                         FROM (SELECT * FROM public.user_devices ud
                               WHERE ud.user_id = _user_id
                               ORDER BY ud.last_seen_at DESC LIMIT 20) d), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'id', pe.id, 'amount_cents', pe.amount_cents, 'currency', pe.currency,
                            'status', pe.status, 'created_at', pe.created_at))
                          FROM (SELECT * FROM public.payment_events p2
                                WHERE p2.user_id = _user_id
                                ORDER BY p2.created_at DESC LIMIT 30) pe), '[]'::jsonb),
    'decks', (SELECT count(*) FROM public.flash_subjects fs WHERE fs.user_id = _user_id),
    'cards', (SELECT count(*) FROM public.flash_cards fc WHERE fc.user_id = _user_id),
    'summaries', (SELECT count(*) FROM public.summaries su WHERE su.user_id = _user_id),
    'spaces', (SELECT count(*) FROM public.space_members sm WHERE sm.user_id = _user_id)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_person_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_person_history(uuid) TO authenticated;
-- FILE: 20260908010840_d0885c3e-80ed-4e8a-badc-e71e0f07f380.sql
CREATE OR REPLACE FUNCTION public.admin_people_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'active_now', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= now() - interval '5 minutes'),
    'opened_today', (SELECT count(*) FROM public.user_sessions WHERE last_seen_at >= date_trunc('day', now())),
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_today', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),
    'new_week', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'new_month', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '30 days'),
    'new_prev_week', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days'),
    'new_prev_month', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days'),
    'logins_today', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= date_trunc('day', now())),
    'logins_week', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '7 days'),
    'logins_month', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '30 days'),
    'logins_prev_week', (SELECT count(*) FROM public.user_login_events WHERE occurred_at >= now() - interval '14 days' AND occurred_at < now() - interval '7 days'),
    'verified', (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
    'unverified', (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NULL),
    'blocked', (SELECT count(*) FROM public.profiles WHERE locked_at IS NOT NULL AND lock_until IS NULL),
    'suspended', (SELECT count(*) FROM public.profiles WHERE locked_at IS NOT NULL AND lock_until IS NOT NULL AND lock_until > now()),
    'never_logged_in', (SELECT count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = p.id)),
    'dormant_30d', (SELECT count(*) FROM public.profiles p WHERE EXISTS (SELECT 1 FROM public.user_login_events e WHERE e.user_id = p.id)
                     AND NOT EXISTS (SELECT 1 FROM public.user_login_events e2 WHERE e2.user_id = p.id AND e2.occurred_at >= now() - interval '30 days')),
    'revenue_cents', COALESCE((SELECT sum(amount_cents) FROM public.payment_events WHERE status = 'completed'), 0),
    'revenue_month_cents', COALESCE((SELECT sum(amount_cents) FROM public.payment_events WHERE status = 'completed' AND created_at >= now() - interval '30 days'), 0),
    'paying_users', (SELECT count(DISTINCT user_id) FROM public.payment_events WHERE status = 'completed' AND user_id IS NOT NULL),
    'course_grants', (SELECT count(*) FROM public.user_courses),
    'owners', (SELECT count(DISTINCT user_id) FROM public.user_courses),
    'generated_at', now()
  ) INTO result;
  RETURN result;
END; $function$;

CREATE OR REPLACE FUNCTION public.user_in_group(_user_id uuid, _group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE g public.user_groups;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO g FROM public.user_groups WHERE id = _group_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_group_members m
             WHERE m.group_id = _group_id AND m.user_id = _user_id) THEN
    RETURN true;
  END IF;
  IF g.kind = 'everyone' THEN RETURN true; END IF;
  IF g.kind = 'admins' THEN
    RETURN public.has_role(_user_id, 'admin'::public.app_role);
  END IF;
  IF g.kind = 'committee' THEN
    RETURN public.has_role(_user_id, 'committee'::public.app_role);
  END IF;
  IF g.kind = 'course_owners' THEN
    RETURN EXISTS (SELECT 1 FROM public.user_courses uc
                   WHERE uc.user_id = _user_id AND uc.course_id = g.course_id);
  END IF;
  IF g.kind = 'package_owners' THEN
    RETURN EXISTS (SELECT 1 FROM public.payment_events pe
                   WHERE pe.user_id = _user_id AND pe.status = 'completed');
  END IF;
  IF g.kind = 'no_course' THEN
    RETURN NOT EXISTS (SELECT 1 FROM public.user_courses uc WHERE uc.user_id = _user_id);
  END IF;
  RETURN false;
END; $function$;

ALTER TABLE public.admin_ai_keys DROP CONSTRAINT IF EXISTS admin_ai_keys_purpose_check;
ALTER TABLE public.admin_ai_keys ADD CONSTRAINT admin_ai_keys_purpose_check
  CHECK (purpose = ANY (ARRAY['shared','aio','rita','lecture','questions','archive','summaries','german','speech']));
-- FILE: 20260908143647_c65926ff-c831-440e-aa2b-2b493bea42a3.sql
GRANT ALL ON SCHEMA public TO sandbox_exec;
GRANT ALL ON ALL TABLES IN SCHEMA public TO sandbox_exec;
ALTER ROLE sandbox_exec SET search_path = public;
-- FILE: 20260908143716_8d009cec-2327-4c93-b974-ac3d9228f688.sql
GRANT USAGE ON SCHEMA auth TO sandbox_exec;
GRANT REFERENCES, SELECT ON auth.users TO sandbox_exec;
GRANT USAGE ON SCHEMA extensions TO sandbox_exec;
GRANT USAGE ON SCHEMA storage TO sandbox_exec;
GRANT ALL ON storage.objects TO sandbox_exec;
GRANT ALL ON storage.buckets TO sandbox_exec;
-- FILE: 20260908143758_75aee9d5-34b3-4f4f-ad40-75d79484add3.sql
CREATE OR REPLACE FUNCTION public.__setup_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
REVOKE ALL ON FUNCTION public.__setup_exec(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO sandbox_exec;
-- FILE: 20260908143841_dc89e4b4-72f3-4f35-ae21-e6c5e5b0082f.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER FUNCTION public.__setup_exec(text) SET search_path = public, extensions;
-- FILE: 20260908144052_ae32f820-e4d6-4d0c-9b9e-9c6eaea3eb7b.sql
CREATE OR REPLACE FUNCTION public.__setup_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
BEGIN
  EXECUTE sql;
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO sandbox_exec';
END;
$fn$;
REVOKE ALL ON FUNCTION public.__setup_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO sandbox_exec;
-- FILE: 20260908144415_4b9ecdf2-7cda-46fd-80a7-75bcbc5cbbb1.sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.__setup_exec(text);
REVOKE ALL ON SCHEMA public FROM sandbox_exec;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM sandbox_exec;
REVOKE ALL ON storage.objects FROM sandbox_exec;
REVOKE ALL ON storage.buckets FROM sandbox_exec;
GRANT USAGE ON SCHEMA public TO sandbox_exec;
-- FILE: 20260908165713_257938d3-c8fd-4425-bbd5-db5b4f8e383b.sql
CREATE TABLE public.site_images (
  key text PRIMARY KEY,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_images TO authenticated;
GRANT ALL ON public.site_images TO service_role;

ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_images_public_read" ON public.site_images
  FOR SELECT USING (true);

CREATE POLICY "site_images_admin_write" ON public.site_images
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_images_touch
  BEFORE UPDATE ON public.site_images
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- FILE: 20260908171430_bb70a96a-1dc3-4c44-be16-1213c1181c8c.sql
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS classic_colors boolean NOT NULL DEFAULT false;
-- FILE: 20260908215404_b71ceaa8-00a5-400c-b105-8e7319219dad.sql
DROP POLICY IF EXISTS "Anon can view free public subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated can view free subjects" ON public.subjects;
DROP POLICY IF EXISTS "Published subject outlines are visible" ON public.subjects;

CREATE POLICY "Published subject outlines are visible"
ON public.subjects
FOR SELECT
TO anon, authenticated
USING (
  owner_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.subject_groups sg
    JOIN public.courses c ON c.id = sg.course_id
    WHERE sg.id = subjects.group_id
      AND c.published = true
  )
);
-- FILE: 20260908215659_a39eac19-aa69-40b3-b660-8058bcb2d082.sql
-- Published official subject names are visible as a bank outline; questions remain protected.
DROP POLICY IF EXISTS "Anon can view free public subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated can view free subjects" ON public.subjects;
DROP POLICY IF EXISTS "Published subject outlines are visible" ON public.subjects;

CREATE POLICY "Published subject outlines are visible"
ON public.subjects
FOR SELECT
TO anon, authenticated
USING (
  owner_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.subject_groups sg
    JOIN public.courses c ON c.id = sg.course_id
    WHERE sg.id = subjects.group_id
      AND c.published = true
  )
);
-- FILE: 20260908215739_5c7738a2-7c37-4628-b7c0-52ae20ab07e6.sql
DO $$
DECLARE
  duplicate_policy_count integer;
BEGIN
  SELECT count(*) INTO duplicate_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'subjects'
    AND policyname = 'Published subject outlines are visible';

  IF duplicate_policy_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one published subject outline policy, found %', duplicate_policy_count;
  END IF;
END
$$;
-- FILE: 20260908215839_82491341-5c43-4270-bb02-005b995aebd5.sql
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'subjects'
    AND policyname = 'Published subject outlines are visible';
  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Question-bank outline access rule is missing';
  END IF;
END
$$;
-- FILE: 20260908215937_93ab2607-6274-496b-b531-e2b4a9662265.sql
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'subjects'
    AND policyname = 'Published subject outlines are visible';
  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Question-bank outline rule verification failed';
  END IF;
END
$$;
-- FILE: 20260908222126_aa295fc0-be7b-4e44-bb6a-8630fc12f72f.sql

-- 1) Helper behind "Set one up for me" in Lecture Lab
CREATE OR REPLACE FUNCTION public.ensure_lq_default_bucket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s_id uuid;
  t_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT id INTO s_id FROM public.lq_subjects
   WHERE user_id = uid AND name = 'My lectures' AND coalesce(is_example, false) = false
   LIMIT 1;
  IF s_id IS NULL THEN
    INSERT INTO public.lq_subjects (user_id, name) VALUES (uid, 'My lectures') RETURNING id INTO s_id;
  END IF;

  SELECT id INTO t_id FROM public.lq_subtopics
   WHERE user_id = uid AND subject_id = s_id AND name = 'General'
   LIMIT 1;
  IF t_id IS NULL THEN
    INSERT INTO public.lq_subtopics (user_id, subject_id, name) VALUES (uid, s_id, 'General') RETURNING id INTO t_id;
  END IF;

  RETURN jsonb_build_object('subjectId', s_id, 'subtopicId', t_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_lq_default_bucket() TO authenticated;

-- 2) Sample content, written once with fixed ids
WITH q(n, stem, a, b, c, d, correct, why) AS (
  VALUES
  (1,'Which valve closes at the start of ventricular systole?','Mitral valve','Aortic valve','Pulmonary valve','Tricuspid valve only','A','Rising ventricular pressure shuts the mitral valve first, producing the S1 sound. The aortic valve opens, not closes, at this moment.'),
  (2,'The first heart sound (S1) is produced by closure of which valves?','Aortic and pulmonary','Mitral and tricuspid','Mitral and aortic','Tricuspid and pulmonary','B','S1 marks closure of the atrioventricular valves. The semilunar valves (aortic and pulmonary) close later, giving S2.'),
  (3,'During isovolumetric contraction, ventricular volume is:','Rising','Falling','Unchanged','Equal to stroke volume','C','All four valves are shut, so no blood enters or leaves while pressure climbs steeply.'),
  (4,'The P wave of the ECG represents:','Atrial depolarisation','Atrial repolarisation','Ventricular depolarisation','Ventricular repolarisation','A','The P wave is atrial depolarisation; atrial repolarisation is hidden inside the QRS complex.'),
  (5,'A normal PR interval lasts about:','0.04-0.08 s','0.12-0.20 s','0.25-0.35 s','0.40-0.50 s','B','0.12-0.20 s is normal; longer than 0.20 s suggests first-degree AV block.'),
  (6,'The pacemaker of the healthy heart is the:','AV node','Bundle of His','Sinoatrial node','Purkinje fibres','C','The SA node fires fastest (60-100/min), so it sets the rhythm; the others are slower back-up pacemakers.'),
  (7,'Stroke volume equals:','End-diastolic volume minus end-systolic volume','End-systolic volume minus end-diastolic volume','Cardiac output times heart rate','Ejection fraction times heart rate','A','What is ejected is what was there at the end of filling minus what is left after the beat.'),
  (8,'Cardiac output is calculated as:','Heart rate divided by stroke volume','Stroke volume divided by heart rate','Heart rate times stroke volume','Stroke volume times ejection fraction','C','Output per minute = beats per minute x volume ejected per beat.'),
  (9,'The dicrotic notch on the aortic pressure trace is caused by:','Mitral valve opening','Aortic valve closure','Atrial contraction','Opening of the pulmonary valve','B','A brief backflow against the closing aortic valve produces the notch early in diastole.'),
  (10,'Most ventricular filling occurs:','During atrial contraction','Passively in early diastole','During isovolumetric relaxation','During the ejection phase','B','About 70-80% is passive; atrial contraction adds the final top-up.'),
  (11,'Preload is best described as:','Resistance the ventricle pumps against','Ventricular wall stretch at end-diastole','Force of contraction independent of stretch','Pressure in the aorta during systole','B','Preload is end-diastolic stretch; the resistance term is afterload.'),
  (12,'The Frank-Starling law states that:','Contraction force falls as fibre length rises','Contraction force rises with end-diastolic fibre length','Heart rate rises with venous return only','Afterload determines stroke volume alone','B','Greater filling stretches the fibres and yields a stronger contraction, matching output to venous return.'),
  (13,'Sympathetic stimulation of the heart mainly acts on which receptors?','Beta-1 adrenergic','Beta-2 adrenergic','Muscarinic M2','Alpha-1 adrenergic','A','Cardiac beta-1 receptors raise rate and contractility; M2 receptors carry the vagal slowing effect.'),
  (14,'A prolonged QT interval increases the risk of:','Atrial fibrillation','Torsades de pointes','First-degree AV block','Sinus bradycardia','B','Delayed repolarisation predisposes to this polymorphic ventricular tachycardia.'),
  (15,'The plateau phase of the ventricular action potential is maintained by:','Sodium influx','Calcium influx','Potassium influx','Chloride efflux','B','Slow L-type calcium entry balances potassium exit, holding the plateau and lengthening the refractory period.')
),
c AS (
  INSERT INTO public.courses (id, title, year, price, category, exam_type, published, subjects_count,
                              questions_count_mid, questions_count_final, kind, university_id, show_on_home)
  VALUES ('11111111-1111-4111-8111-111111111111', 'RitaJet sample bank — Cardiac physiology', 1, 0,
          'major', 'MCQ', true, 1, 15, 0, 'questions', '11111111-1111-4111-8111-1111111111aa', true)
  RETURNING id
),
g AS (
  INSERT INTO public.subject_groups (id, course_id, name, sort_order)
  SELECT '22222222-2222-4222-8222-222222222222', c.id, 'Cardiovascular system', 0 FROM c
  RETURNING id
),
s AS (
  INSERT INTO public.subjects (id, group_id, name, sort_order, access_level)
  SELECT '33333333-3333-4333-8333-333333333333', g.id, 'Cardiac cycle & ECG', 0, 'free_public'::subject_access FROM g
  RETURNING id
),
ins_q AS (
  INSERT INTO public.questions (id, subject_id, stem, explanation, sort_order)
  SELECT ('44444444-4444-4444-8444-' || lpad(q.n::text, 12, '0'))::uuid, s.id, q.stem, q.why, q.n
  FROM q CROSS JOIN s
  RETURNING id, sort_order
)
INSERT INTO public.question_options (question_id, label, text, is_correct, sort_order)
SELECT ins_q.id, o.label, o.text, o.label = q.correct, o.ord
FROM ins_q
JOIN q ON q.n = ins_q.sort_order
CROSS JOIN LATERAL (VALUES ('A', q.a, 0), ('B', q.b, 1), ('C', q.c, 2), ('D', q.d, 3)) AS o(label, text, ord);

-- 3) Lecture Lab shared example (same material)
WITH q(n, stem, a, b, c, d, correct, why) AS (
  VALUES
  (1,'Which valve closes at the start of ventricular systole?','Mitral valve','Aortic valve','Pulmonary valve','Tricuspid valve only','A','Rising ventricular pressure shuts the mitral valve first, producing S1. The aortic valve opens here instead.'),
  (2,'The first heart sound (S1) is produced by closure of which valves?','Aortic and pulmonary','Mitral and tricuspid','Mitral and aortic','Tricuspid and pulmonary','B','S1 is atrioventricular valve closure; the semilunar valves make S2.'),
  (3,'During isovolumetric contraction, ventricular volume is:','Rising','Falling','Unchanged','Equal to stroke volume','C','All valves are shut, so pressure rises with no volume change.'),
  (4,'The P wave of the ECG represents:','Atrial depolarisation','Atrial repolarisation','Ventricular depolarisation','Ventricular repolarisation','A','Atrial repolarisation hides inside the QRS complex.'),
  (5,'A normal PR interval lasts about:','0.04-0.08 s','0.12-0.20 s','0.25-0.35 s','0.40-0.50 s','B','Above 0.20 s means first-degree AV block.'),
  (6,'The pacemaker of the healthy heart is the:','AV node','Bundle of His','Sinoatrial node','Purkinje fibres','C','The SA node has the fastest intrinsic rate, so it leads.'),
  (7,'Stroke volume equals:','End-diastolic volume minus end-systolic volume','End-systolic volume minus end-diastolic volume','Cardiac output times heart rate','Ejection fraction times heart rate','A','Ejected volume = filled volume minus what remains.'),
  (8,'Cardiac output is calculated as:','Heart rate divided by stroke volume','Stroke volume divided by heart rate','Heart rate times stroke volume','Stroke volume times ejection fraction','C','Beats per minute multiplied by volume per beat.'),
  (9,'The dicrotic notch is caused by:','Mitral valve opening','Aortic valve closure','Atrial contraction','Pulmonary valve opening','B','A brief backflow against the closing aortic valve marks the notch.'),
  (10,'Most ventricular filling occurs:','During atrial contraction','Passively in early diastole','During isovolumetric relaxation','During ejection','B','Passive filling supplies roughly three quarters of the volume.'),
  (11,'Preload is best described as:','Resistance pumped against','Ventricular stretch at end-diastole','Contractility independent of stretch','Aortic systolic pressure','B','Resistance pumped against is afterload, not preload.'),
  (12,'The Frank-Starling law states that:','Force falls as fibre length rises','Force rises with end-diastolic fibre length','Rate rises with venous return only','Afterload alone sets stroke volume','B','More stretch gives a stronger beat, matching output to venous return.'),
  (13,'Sympathetic drive to the heart acts mainly on:','Beta-1 receptors','Beta-2 receptors','Muscarinic M2 receptors','Alpha-1 receptors','A','Beta-1 raises rate and contractility; M2 carries vagal slowing.'),
  (14,'A prolonged QT interval risks:','Atrial fibrillation','Torsades de pointes','First-degree AV block','Sinus bradycardia','B','Delayed repolarisation triggers this polymorphic VT.'),
  (15,'The action potential plateau is held by:','Sodium influx','Calcium influx','Potassium influx','Chloride efflux','B','Slow calcium entry offsets potassium exit during the plateau.')
),
sub AS (
  INSERT INTO public.lq_subjects (id, user_id, name, sort_order, is_example)
  VALUES ('55555555-5555-4555-8555-555555555555', '79ce765f-5323-48c1-8fe3-51eb56b32755', 'RitaJet examples', 0, true)
  RETURNING id
),
top AS (
  INSERT INTO public.lq_subtopics (id, user_id, subject_id, name, sort_order, is_example)
  SELECT '66666666-6666-4666-8666-666666666666', '79ce765f-5323-48c1-8fe3-51eb56b32755', sub.id, 'Cardiac physiology', 0, true FROM sub
  RETURNING id
),
lec AS (
  INSERT INTO public.lq_lectures (id, user_id, subtopic_id, title, source_name, difficulty, key_points, question_count, is_example)
  SELECT '77777777-7777-4777-8777-777777777777', '79ce765f-5323-48c1-8fe3-51eb56b32755', top.id,
         'Sample lecture — the cardiac cycle', 'RitaJet sample', 'mixed',
         '["The cardiac cycle alternates systole and diastole about once a second at rest.","S1 is AV valve closure; S2 is semilunar valve closure.","Isovolumetric phases happen with all four valves shut.","The SA node sets the rhythm; the AV node delays conduction.","P wave = atrial depolarisation, QRS = ventricular depolarisation, T wave = ventricular repolarisation.","Stroke volume = end-diastolic minus end-systolic volume.","Cardiac output = heart rate x stroke volume.","Frank-Starling: more filling gives a stronger beat.","Beta-1 stimulation raises rate and force; vagal M2 slows the heart.","The calcium plateau keeps the ventricle refractory during ejection."]'::jsonb,
         15, true
  FROM top
  RETURNING id
)
INSERT INTO public.lq_questions (user_id, lecture_id, stem, options, explanation, point_ref, sort_order)
SELECT '79ce765f-5323-48c1-8fe3-51eb56b32755', lec.id, q.stem,
       jsonb_build_array(
         jsonb_build_object('letter','A','body',q.a,'is_correct', q.correct = 'A'),
         jsonb_build_object('letter','B','body',q.b,'is_correct', q.correct = 'B'),
         jsonb_build_object('letter','C','body',q.c,'is_correct', q.correct = 'C'),
         jsonb_build_object('letter','D','body',q.d,'is_correct', q.correct = 'D')
       ),
       q.why, 'Cardiac cycle', q.n
FROM q CROSS JOIN lec;

-- FILE: 20260908222447_16ed8e42-67db-4149-837e-8ba62225f17d.sql
GRANT EXECUTE ON FUNCTION public.get_subject_question_counts(uuid[]) TO anon;
-- FILE: 20260908224831_bf3aca0c-ef1c-4179-aa44-8e3c42941651.sql
CREATE POLICY "avatars_read_authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- FILE: 20260909011534_84e7580f-a831-4b9c-85d9-ede7ba12a4db.sql
DROP POLICY IF EXISTS "courses readable" ON public.courses;
DROP POLICY IF EXISTS "subjects readable" ON public.subjects;

DROP POLICY IF EXISTS "Published subject outlines are visible" ON public.subjects;
CREATE POLICY "Published subject outlines are visible"
ON public.subjects
FOR SELECT
TO anon, authenticated
USING (
  owner_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.subject_groups sg
    JOIN public.courses c ON c.id = sg.course_id
    WHERE sg.id = subjects.group_id
      AND c.published = true
      AND c.admin_only = false
  )
);
-- FILE: 20260909011742_0ccaa847-003a-404a-af7f-932f6680c076.sql
DROP POLICY IF EXISTS "events insert" ON public.announcement_events;

CREATE POLICY "Anonymous visitors can record anonymous events"
ON public.announcement_events
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

CREATE POLICY "Members can record their own events"
ON public.announcement_events
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
-- FILE: 20260909134851_bd030b2e-73f3-4856-8557-e0d2f2c41dd8.sql
-- 1. Keep only the rheumatic fever sample questions
DELETE FROM public.questions
WHERE subject_id = '33333333-3333-4333-8333-333333333333'
  AND stem NOT ILIKE '%rheumatic%'
  AND stem NOT ILIKE '%sore throat%';

-- 2. Rename the sample bank
UPDATE public.courses SET title = 'RitaJet sample bank — Rheumatic fever'
  WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE public.subject_groups SET name = 'Rheumatic fever'
  WHERE id = '22222222-2222-4222-8222-222222222222';
UPDATE public.subjects
   SET name = 'Rheumatic fever — shared example', access_level = 'free_public'
  WHERE id = '33333333-3333-4333-8333-333333333333';

-- 3. Rita 3.8 is gone from plans
ALTER TABLE public.plans DROP COLUMN IF EXISTS feature_rita38;
ALTER TABLE public.plans DROP COLUMN IF EXISTS max_rita_questions;

-- 4. Every paid plan gets unlimited flashcards
UPDATE public.plans SET max_flashcards = NULL WHERE price_cents >= 500;

-- 5. Free toolkit code
INSERT INTO public.toolkit_codes (code, plan_slug, label, max_uses, is_active)
VALUES ('AquaQbank', 'toolkit', 'AquaQbank — free toolkit', NULL, true)
ON CONFLICT (code) DO UPDATE
  SET plan_slug = EXCLUDED.plan_slug,
      label = EXCLUDED.label,
      max_uses = NULL,
      expires_at = NULL,
      is_active = true;
-- FILE: 20260909135008_cbe1424b-1641-4c35-87f7-03efd6b4c303.sql
CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _slug text;
  _base public.plans%ROWTYPE;
  _op public.plans%ROWTYPE;
  _claim public.toolkit_claims%ROWTYPE;
  _out jsonb;
BEGIN
  SELECT plan_slug INTO _slug FROM public.user_plans WHERE user_id = _user_id;
  IF _slug IS NULL THEN _slug := 'starter'; END IF;
  SELECT * INTO _base FROM public.plans WHERE slug = _slug;
  IF _base.slug IS NULL THEN
    SELECT * INTO _base FROM public.plans WHERE published ORDER BY sort LIMIT 1;
  END IF;
  _out := to_jsonb(_base);

  SELECT c.* INTO _claim FROM public.toolkit_claims c
   WHERE c.user_id = _user_id
     AND (c.expires_at IS NULL OR c.expires_at > now())
     AND c.offer_id IS NOT NULL
   ORDER BY c.created_at DESC LIMIT 1;

  IF _claim.id IS NOT NULL THEN
    SELECT * INTO _op FROM public.plans WHERE slug = _claim.plan_slug;
    IF _op.slug IS NOT NULL THEN
      _out := _out || jsonb_build_object(
        'name', _base.name || ' + ' || _op.name,
        'max_flashcards',           public.merge_cap(_base.max_flashcards, _op.max_flashcards),
        'max_ai_questions',         public.merge_cap(_base.max_ai_questions, _op.max_ai_questions),
        'max_summaries',            public.merge_cap(_base.max_summaries, _op.max_summaries),
        'max_todo_tasks',           public.merge_cap(_base.max_todo_tasks, _op.max_todo_tasks),
        'max_calendar_items',       public.merge_cap(_base.max_calendar_items, _op.max_calendar_items),
        'max_groups',               public.merge_cap(_base.max_groups, _op.max_groups),
        'max_all_in_one_lectures',  public.merge_cap(_base.max_all_in_one_lectures, _op.max_all_in_one_lectures),
        'max_all_in_one_questions', public.merge_cap(_base.max_all_in_one_questions, _op.max_all_in_one_questions),
        'max_archive_questions',    public.merge_cap(_base.max_archive_questions, _op.max_archive_questions),
        'todo_full',             _base.todo_full OR _op.todo_full,
        'rich_cards',            _base.rich_cards OR _op.rich_cards,
        'feature_lecture_qgen',  _base.feature_lecture_qgen OR _op.feature_lecture_qgen,
        'feature_archive_qgen',  _base.feature_archive_qgen OR _op.feature_archive_qgen,
        'feature_all_in_one',    _base.feature_all_in_one OR _op.feature_all_in_one,
        'offer_name', _op.name,
        'offer_plan_slug', _op.slug,
        'offer_expires_at', _claim.expires_at
      );
    END IF;
  END IF;

  RETURN _out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_plan_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _plan jsonb;
  _usage public.usage_counters%ROWTYPE;
  _admin boolean;
  _g jsonb;
  _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  _admin := public.has_role(_uid, 'admin');
  _plan := public.effective_plan(_uid);

  SELECT * INTO _usage FROM public.usage_counters WHERE user_id = _uid AND period = 'lifetime';

  SELECT jsonb_build_object(
    'summaries', COALESCE(SUM(summaries),0),
    'ai_questions', COALESCE(SUM(ai_questions),0),
    'flashcards', COALESCE(SUM(flashcards),0),
    'todo_tasks', COALESCE(SUM(todo_tasks),0),
    'calendar_items', COALESCE(SUM(calendar_items),0),
    'all_in_one_lectures', COALESCE(SUM(all_in_one_lectures),0),
    'all_in_one_questions', COALESCE(SUM(all_in_one_questions),0),
    'archive_questions', COALESCE(SUM(archive_questions),0),
    'groups', COALESCE(SUM(groups),0)
  ) INTO _g
  FROM public.plan_credit_grants
  WHERE user_id = _uid AND (expires_at IS NULL OR expires_at > now());

  SELECT max(c.expires_at) INTO _exp FROM public.toolkit_claims c
   WHERE c.user_id = _uid AND c.expires_at IS NOT NULL AND c.expires_at > now();

  RETURN jsonb_build_object(
    'plan', _plan,
    'grants', COALESCE(_g, '{}'::jsonb),
    'offer_expires_at', _exp,
    'offer_name', _plan->>'offer_name',
    'usage', jsonb_build_object(
      'summaries', COALESCE(_usage.summaries, 0),
      'ai_questions', COALESCE(_usage.ai_questions, 0),
      'flashcards', COALESCE(_usage.flashcards, 0),
      'todo_tasks', COALESCE(_usage.todo_tasks, 0),
      'calendar_items', COALESCE(_usage.calendar_items, 0),
      'all_in_one_lectures', COALESCE(_usage.all_in_one_lectures, 0),
      'all_in_one_questions', COALESCE(_usage.all_in_one_questions, 0),
      'archive_questions', COALESCE(_usage.archive_questions, 0),
      'groups', COALESCE(_usage.groups, 0)
    ),
    'is_admin', _admin
  );
END;
$function$;
-- FILE: 20260909142731_ccd534ce-2a02-474e-b32e-91bdf8ad8314.sql
REVOKE ALL ON FUNCTION public.identity_taken(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO anon, authenticated, service_role;
-- FILE: 20260909142804_3c6f5600-0b50-4787-8e6e-e7e18ba79253.sql
REVOKE ALL ON FUNCTION public.identity_taken(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO service_role;
-- FILE: 20260909144239_f909d7cc-0af9-4894-b4c9-f6748a0f66f1.sql
DROP FUNCTION IF EXISTS public.identity_taken(text, text);
-- FILE: 20260909205340_317fb4af-308c-4231-b0dd-d9ca57faaf31.sql
CREATE TABLE public.shared_question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  cover text NOT NULL DEFAULT 'sky',
  emoji text,
  tags text[] NOT NULL DEFAULT '{}',
  question_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  audience text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shared_question_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.space_question_sets (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, set_id)
);

CREATE INDEX shared_question_sets_feed_idx
  ON public.shared_question_sets (audience, published, created_at DESC);
CREATE INDEX shared_question_sets_top_idx
  ON public.shared_question_sets (audience, published, save_count DESC);
CREATE INDEX shared_question_sets_owner_idx ON public.shared_question_sets (owner_id, created_at DESC);
CREATE INDEX shared_question_items_set_idx ON public.shared_question_items (set_id, sort);
CREATE INDEX space_question_sets_set_idx ON public.space_question_sets (set_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_sets TO authenticated;
GRANT ALL ON public.shared_question_sets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_items TO authenticated;
GRANT ALL ON public.shared_question_items TO service_role;
GRANT SELECT, INSERT, DELETE ON public.space_question_sets TO authenticated;
GRANT ALL ON public.space_question_sets TO service_role;

ALTER TABLE public.shared_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_question_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_question_sets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_question_set(_set_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_question_sets s
    WHERE s.id = _set_id
      AND (
        s.owner_id = _user_id
        OR (s.published AND s.audience = 'public')
        OR EXISTS (
          SELECT 1 FROM public.space_question_sets q
          WHERE q.set_id = s.id AND public.is_space_member(q.space_id, _user_id)
        )
      )
  )
$$;

CREATE POLICY "own question sets" ON public.shared_question_sets
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "read public question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (published AND audience = 'public');

CREATE POLICY "read space question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.space_question_sets q
    WHERE q.set_id = shared_question_sets.id AND public.is_space_member(q.space_id, auth.uid())
  ));

CREATE POLICY "own question items" ON public.shared_question_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "read shared question items" ON public.shared_question_items
  FOR SELECT TO authenticated
  USING (public.can_read_question_set(set_id, auth.uid()));

CREATE POLICY "members read space question sets" ON public.space_question_sets
  FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

CREATE POLICY "members add space question sets" ON public.space_question_sets
  FOR INSERT TO authenticated
  WITH CHECK (public.space_can_add_decks(space_id, auth.uid()));

CREATE POLICY "remove space question sets" ON public.space_question_sets
  FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

CREATE TRIGGER shared_question_sets_touch
  BEFORE UPDATE ON public.shared_question_sets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- FILE: 20260909215723_5d7d44c0-8d02-45da-bbdc-64de6da4a0a4.sql
update public.plans set paddle_price_monthly = 'study_monthly', paddle_price_yearly = 'study_yearly' where slug = 'study';
-- FILE: 20260909235022_0b78e2c7-341e-408a-8b72-4cd43f42b4fe.sql
DROP TABLE IF EXISTS public.space_question_sets CASCADE;
DROP TABLE IF EXISTS public.shared_question_items CASCADE;
DROP TABLE IF EXISTS public.shared_question_sets CASCADE;
DROP FUNCTION IF EXISTS public.can_read_question_set(uuid, uuid);
-- FILE: 20260910152751_58055134-ff74-4b62-bade-109ca23e40db.sql
CREATE TABLE public.manual_plan_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_slug text NOT NULL REFERENCES public.plans(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reason text NOT NULL DEFAULT '',
  overrides_paid boolean NOT NULL DEFAULT true,
  granted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  revoke_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_plan_grants_valid_window CHECK (expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT manual_plan_grants_reason_length CHECK (char_length(reason) <= 500),
  CONSTRAINT manual_plan_grants_revoke_reason_length CHECK (revoke_reason IS NULL OR char_length(revoke_reason) <= 500)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_plan_grants TO authenticated;
GRANT ALL ON public.manual_plan_grants TO service_role;
ALTER TABLE public.manual_plan_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own manual access" ON public.manual_plan_grants FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins create manual access" ON public.manual_plan_grants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND granted_by = auth.uid());
CREATE POLICY "Admins update manual access" ON public.manual_plan_grants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete manual access" ON public.manual_plan_grants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX manual_plan_grants_user_active_idx ON public.manual_plan_grants (user_id, starts_at DESC, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX manual_plan_grants_admin_history_idx ON public.manual_plan_grants (granted_at DESC);
CREATE OR REPLACE FUNCTION public.touch_manual_plan_grant_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER touch_manual_plan_grants BEFORE UPDATE ON public.manual_plan_grants FOR EACH ROW EXECUTE FUNCTION public.touch_manual_plan_grant_updated_at();
CREATE OR REPLACE FUNCTION public.effective_plan_slug(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_manual AS (
    SELECT mpg.plan_slug, mpg.overrides_paid, mpg.granted_at
    FROM public.manual_plan_grants mpg
    WHERE mpg.user_id = _user_id
      AND mpg.revoked_at IS NULL
      AND mpg.starts_at <= now()
      AND (mpg.expires_at IS NULL OR mpg.expires_at > now())
    ORDER BY mpg.overrides_paid DESC, mpg.granted_at DESC
    LIMIT 1
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM active_manual WHERE overrides_paid) THEN (SELECT plan_slug FROM active_manual)
    ELSE COALESCE((SELECT up.plan_slug FROM public.user_plans up WHERE up.user_id = _user_id), (SELECT plan_slug FROM active_manual), 'starter')
  END;
$$;
REVOKE ALL ON FUNCTION public.effective_plan_slug(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_plan_slug(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slug text;
  _base public.plans%ROWTYPE;
  _op public.plans%ROWTYPE;
  _claim public.toolkit_claims%ROWTYPE;
  _out jsonb;
BEGIN
  _slug := public.effective_plan_slug(_user_id);
  SELECT * INTO _base FROM public.plans WHERE slug = _slug;
  IF _base.slug IS NULL THEN SELECT * INTO _base FROM public.plans WHERE published ORDER BY sort LIMIT 1; END IF;
  _out := to_jsonb(_base);
  SELECT c.* INTO _claim FROM public.toolkit_claims c WHERE c.user_id = _user_id AND (c.expires_at IS NULL OR c.expires_at > now()) AND c.offer_id IS NOT NULL ORDER BY c.created_at DESC LIMIT 1;
  IF _claim.id IS NOT NULL THEN
    SELECT * INTO _op FROM public.plans WHERE slug = _claim.plan_slug;
    IF _op.slug IS NOT NULL THEN
      _out := _out || jsonb_build_object(
        'name', _base.name || ' + ' || _op.name,
        'max_flashcards', public.merge_cap(_base.max_flashcards, _op.max_flashcards),
        'max_ai_questions', public.merge_cap(_base.max_ai_questions, _op.max_ai_questions),
        'max_summaries', public.merge_cap(_base.max_summaries, _op.max_summaries),
        'max_todo_tasks', public.merge_cap(_base.max_todo_tasks, _op.max_todo_tasks),
        'max_calendar_items', public.merge_cap(_base.max_calendar_items, _op.max_calendar_items),
        'max_groups', public.merge_cap(_base.max_groups, _op.max_groups),
        'max_all_in_one_lectures', public.merge_cap(_base.max_all_in_one_lectures, _op.max_all_in_one_lectures),
        'max_all_in_one_questions', public.merge_cap(_base.max_all_in_one_questions, _op.max_all_in_one_questions),
        'max_archive_questions', public.merge_cap(_base.max_archive_questions, _op.max_archive_questions),
        'max_rita_questions', public.merge_cap(_base.max_rita_questions, _op.max_rita_questions),
        'todo_full', _base.todo_full OR _op.todo_full,
        'rich_cards', _base.rich_cards OR _op.rich_cards,
        'feature_lecture_qgen', _base.feature_lecture_qgen OR _op.feature_lecture_qgen,
        'feature_archive_qgen', _base.feature_archive_qgen OR _op.feature_archive_qgen,
        'feature_all_in_one', _base.feature_all_in_one OR _op.feature_all_in_one,
        'feature_rita38', _base.feature_rita38 OR _op.feature_rita38,
        'offer_name', _op.name,
        'offer_plan_slug', _op.slug,
        'offer_expires_at', _claim.expires_at
      );
    END IF;
  END IF;
  RETURN _out;
END;
$$;
-- FILE: 20260910152822_128cb193-9101-424f-b8f7-f829971bad08.sql
REVOKE ALL ON FUNCTION public.effective_plan_slug(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan_slug(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.effective_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid) TO service_role;
-- FILE: 20260910220933_899c7d81-6740-4fdb-95d1-56ddc8c3270c.sql
-- 1. Lock down SECURITY DEFINER helpers not meant for direct client calls
REVOKE EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_tables() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_lq_default_bucket() FROM anon;

-- 2. Public counts should respect RLS instead of bypassing it
ALTER FUNCTION public.get_subject_question_counts(uuid[]) SECURITY INVOKER;

-- 3. Avatars: remove anonymous read of a private bucket (authenticated policy stays)
DROP POLICY IF EXISTS "avatars are viewable" ON storage.objects;

-- 4. public_profiles: scope authenticated reads
DROP POLICY IF EXISTS "profiles readable by members" ON public.public_profiles;
CREATE POLICY "profiles readable in context"
ON public.public_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.shared_decks d
    WHERE d.owner_id = public_profiles.id AND d.published = true
  )
  OR EXISTS (
    SELECT 1 FROM public.space_members me
    JOIN public.space_members them ON them.space_id = me.space_id
    WHERE me.user_id = auth.uid() AND them.user_id = public_profiles.id
  )
);
-- FILE: 20260910221101_b4da4217-4b1e-4f15-a75f-c0a62bbb1d10.sql
DROP POLICY IF EXISTS "site-media readable" ON storage.objects;

CREATE POLICY "site-media published readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'site-media'
  AND (
    EXISTS (SELECT 1 FROM public.site_images si WHERE si.path = storage.objects.name)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
-- FILE: 20260910221119_90959727-fb36-44fe-9d4c-8fdc029708c6.sql
REVOKE EXECUTE ON FUNCTION public.ensure_lq_default_bucket() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_lq_default_bucket() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.vault_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_tables() TO service_role;
-- FILE: 20260911002516_befb5849-a5a7-4e0d-8321-762cf941c353.sql
UPDATE public.site_images SET path = CASE key WHEN 'home.ipad' THEN 'https://ritajet.com/__l5e/assets-v1/e715e252-b093-484d-98d9-8e3144845769/home-ipad-restored.webp' WHEN 'home.product.plans' THEN 'https://ritajet.com/__l5e/assets-v1/026ce4c2-d905-41b1-be18-2947c9348410/home-plans-restored.webp' WHEN 'home.product.toolkit' THEN 'https://ritajet.com/__l5e/assets-v1/ad926651-d59e-4c48-88bd-52249477742f/home-toolkit-restored.webp' END WHERE key IN ('home.ipad','home.product.plans','home.product.toolkit');
-- FILE: 20260911053000_activate_user_plan.sql
-- Helper function to activate or change a user's plan securely
CREATE OR REPLACE FUNCTION public.activate_user_plan(_user_id uuid, _plan_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = _plan_slug) THEN
    RAISE EXCEPTION 'Plan with slug % does not exist', _plan_slug;
  END IF;

  INSERT INTO public.user_plans (user_id, plan_slug, updated_at)
  VALUES (_user_id, _plan_slug, now())
  ON CONFLICT (user_id)
  DO UPDATE SET plan_slug = EXCLUDED.plan_slug, updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_user_plan(uuid, text) TO authenticated, service_role;

-- Helper function to cancel user's subscription at period end securely
CREATE OR REPLACE FUNCTION public.cancel_user_subscription(_user_id uuid, _paddle_sub_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET cancel_at_period_end = true, updated_at = now()
  WHERE user_id = _user_id AND paddle_subscription_id = _paddle_sub_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, text) TO authenticated, service_role;

-- FILE: 20260911060000_customer_payment_methods.sql
-- Create customer_payment_methods table to store saved cards for accounts
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paddle_customer_id text,
  paddle_payment_method_id text,
  card_brand text NOT NULL DEFAULT 'card',
  card_last4 text NOT NULL,
  card_exp_month integer,
  card_exp_year integer,
  cardholder_name text,
  is_default boolean DEFAULT true,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_user_id ON public.customer_payment_methods(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payment_methods TO authenticated, service_role;
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view their own payment methods"
    ON public.customer_payment_methods FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage their own payment methods"
    ON public.customer_payment_methods FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RPC helper to atomically remove card and cancel auto-renew
CREATE OR REPLACE FUNCTION public.remove_user_card_and_cancel_auto_renew(_user_id uuid, _card_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark any active subscriptions for this user as cancel_at_period_end
  UPDATE public.subscriptions
  SET cancel_at_period_end = true, updated_at = now()
  WHERE user_id = _user_id;

  -- Delete the card from user account
  DELETE FROM public.customer_payment_methods
  WHERE id = _card_id AND user_id = _user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_user_card_and_cancel_auto_renew(uuid, uuid) TO authenticated, service_role;

-- FILE: 20260911073000_promo_redemptions.sql
-- Migration: Create promo_code_redemptions table to track promo code usage per user
CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  plan_slug text NOT NULL,
  billing text NOT NULL DEFAULT 'three_months',
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_code_redemptions_user_code_uniq UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_user_code
  ON public.promo_code_redemptions (user_id, code);

GRANT SELECT, INSERT ON public.promo_code_redemptions TO authenticated, service_role;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own promo redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Users read own promo redemptions"
  ON public.promo_code_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users insert own promo redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Users insert own promo redemptions"
  ON public.promo_code_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Ensure toolkit_claims has expires_at column for /my-plan countdown timer
ALTER TABLE public.toolkit_claims ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- FILE: 20260911084500_device_limit_and_question_sharing.sql
-- 1. Device Limit update to 50 devices & unlock affected accounts
UPDATE public.device_security_settings
  SET default_device_limit = 50
  WHERE id = true;

UPDATE public.profiles
  SET device_limit = 50
  WHERE device_limit IS NOT NULL AND device_limit < 50;

UPDATE public.profiles
  SET locked_at = NULL, lock_reason = NULL
  WHERE lock_reason = 'device_limit';

-- 2. Shared Question Sets
CREATE TABLE IF NOT EXISTS public.shared_question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'lecture', -- 'bank' | 'archive' | 'lecture'
  subject text,
  cover text NOT NULL DEFAULT 'sky',
  emoji text,
  tags text[] NOT NULL DEFAULT '{}',
  question_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  audience text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Shared Question Items
CREATE TABLE IF NOT EXISTS public.shared_question_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'lecture',
  subject text,
  subtopic text,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Space Question Sets join table
CREATE TABLE IF NOT EXISTS public.space_question_sets (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, set_id)
);

-- 5. Shared Question Saves table
CREATE TABLE IF NOT EXISTS public.shared_question_saves (
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS shared_question_sets_feed_idx
  ON public.shared_question_sets (audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS shared_question_sets_top_idx
  ON public.shared_question_sets (audience, published, save_count DESC);
CREATE INDEX IF NOT EXISTS shared_question_sets_owner_idx
  ON public.shared_question_sets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shared_question_sets_source_idx
  ON public.shared_question_sets (source_type);
CREATE INDEX IF NOT EXISTS shared_question_items_set_idx
  ON public.shared_question_items (set_id, sort);
CREATE INDEX IF NOT EXISTS space_question_sets_set_idx
  ON public.space_question_sets (set_id);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_sets TO authenticated;
GRANT ALL ON public.shared_question_sets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_question_items TO authenticated;
GRANT ALL ON public.shared_question_items TO service_role;
GRANT SELECT, INSERT, DELETE ON public.space_question_sets TO authenticated;
GRANT ALL ON public.space_question_sets TO service_role;
GRANT SELECT, INSERT, DELETE ON public.shared_question_saves TO authenticated;
GRANT ALL ON public.shared_question_saves TO service_role;

-- Enable RLS
ALTER TABLE public.shared_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_question_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_question_saves ENABLE ROW LEVEL SECURITY;

-- Helper function to check read permission
CREATE OR REPLACE FUNCTION public.can_read_question_set(_set_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_question_sets s
    WHERE s.id = _set_id
      AND (
        s.owner_id = _user_id
        OR (s.published AND s.audience = 'public')
        OR EXISTS (
          SELECT 1 FROM public.space_question_sets q
          WHERE q.set_id = s.id AND public.is_space_member(q.space_id, _user_id)
        )
      )
  )
$$;

-- RLS Policies
DROP POLICY IF EXISTS "own question sets" ON public.shared_question_sets;
CREATE POLICY "own question sets" ON public.shared_question_sets
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "read public question sets" ON public.shared_question_sets;
CREATE POLICY "read public question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (published AND audience = 'public');

DROP POLICY IF EXISTS "read space question sets" ON public.shared_question_sets;
CREATE POLICY "read space question sets" ON public.shared_question_sets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.space_question_sets q
    WHERE q.set_id = shared_question_sets.id AND public.is_space_member(q.space_id, auth.uid())
  ));

DROP POLICY IF EXISTS "own question items" ON public.shared_question_items;
CREATE POLICY "own question items" ON public.shared_question_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "read shared question items" ON public.shared_question_items;
CREATE POLICY "read shared question items" ON public.shared_question_items
  FOR SELECT TO authenticated
  USING (public.can_read_question_set(set_id, auth.uid()));

DROP POLICY IF EXISTS "members read space question sets" ON public.space_question_sets;
CREATE POLICY "members read space question sets" ON public.space_question_sets
  FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

DROP POLICY IF EXISTS "members add space question sets" ON public.space_question_sets;
CREATE POLICY "members add space question sets" ON public.space_question_sets
  FOR INSERT TO authenticated
  WITH CHECK (public.space_can_add_decks(space_id, auth.uid()));

DROP POLICY IF EXISTS "remove space question sets" ON public.space_question_sets;
CREATE POLICY "remove space question sets" ON public.space_question_sets
  FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.can_manage_space(space_id, auth.uid()));

DROP POLICY IF EXISTS "manage own question saves" ON public.shared_question_saves;
CREATE POLICY "manage own question saves" ON public.shared_question_saves
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Function to bump save counts
CREATE OR REPLACE FUNCTION public.bump_question_set_saves(_set_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shared_question_sets
     SET save_count = (SELECT count(*) FROM public.shared_question_saves s WHERE s.set_id = _set_id)
   WHERE id = _set_id;
$$;
REVOKE ALL ON FUNCTION public.bump_question_set_saves(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_question_set_saves(uuid) TO authenticated;

-- FILE: 20260911091500_sharing_scale_quota_and_ratings.sql
-- ============================================================
-- Sharing Scale, 5/Day Quota Support, Space Folders & Question Ratings
-- ============================================================

-- 1. Space Folder column on space_question_sets
ALTER TABLE public.space_question_sets
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.space_deck_folders(id) ON DELETE SET NULL;

-- 2. Rating columns on shared_question_sets
ALTER TABLE public.shared_question_sets
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

-- 3. Question set ratings table
CREATE TABLE IF NOT EXISTS public.question_set_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.shared_question_sets(id) ON DELETE CASCADE,
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  note text,
  under_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS question_set_ratings_one_global
  ON public.question_set_ratings (user_id, set_id) WHERE space_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS question_set_ratings_one_space
  ON public.question_set_ratings (user_id, set_id, space_id) WHERE space_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS question_set_ratings_set_idx
  ON public.question_set_ratings (set_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_set_ratings TO authenticated;
GRANT ALL ON public.question_set_ratings TO service_role;
ALTER TABLE public.question_set_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own question set rating read" ON public.question_set_ratings;
CREATE POLICY "own question set rating read" ON public.question_set_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own question set rating write" ON public.question_set_ratings;
CREATE POLICY "own question set rating write" ON public.question_set_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own question set rating update" ON public.question_set_ratings;
CREATE POLICY "own question set rating update" ON public.question_set_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own question set rating delete" ON public.question_set_ratings;
CREATE POLICY "own question set rating delete" ON public.question_set_ratings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Recount trigger
CREATE OR REPLACE FUNCTION public.recount_question_set_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _set uuid;
BEGIN
  _set := COALESCE(NEW.set_id, OLD.set_id);
  UPDATE public.shared_question_sets s SET
    rating_avg = COALESCE((SELECT ROUND(AVG(r.stars)::numeric, 2) FROM public.question_set_ratings r
                            WHERE r.set_id = _set AND r.space_id IS NULL AND NOT r.under_review), 0),
    rating_count = COALESCE((SELECT COUNT(*) FROM public.question_set_ratings r
                            WHERE r.set_id = _set AND r.space_id IS NULL AND NOT r.under_review), 0)
  WHERE s.id = _set;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS question_set_ratings_recount ON public.question_set_ratings;
CREATE TRIGGER question_set_ratings_recount
AFTER INSERT OR UPDATE OR DELETE ON public.question_set_ratings
FOR EACH ROW EXECUTE FUNCTION public.recount_question_set_rating();

-- Rate a question set RPC
CREATE OR REPLACE FUNCTION public.rate_question_set(_set_id uuid, _stars smallint, _note text DEFAULT NULL, _space_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  IF _stars < 1 OR _stars > 5 THEN RAISE EXCEPTION 'stars must be 1..5'; END IF;
  IF _space_id IS NOT NULL AND NOT public.is_space_member(_space_id, _uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT (p.created_at > now() - interval '2 days') INTO _new FROM public.profiles p WHERE p.id = _uid;

  IF _space_id IS NULL THEN
    INSERT INTO public.question_set_ratings (set_id, user_id, stars, note, under_review)
    VALUES (_set_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, set_id) WHERE space_id IS NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  ELSE
    INSERT INTO public.question_set_ratings (set_id, space_id, user_id, stars, note, under_review)
    VALUES (_set_id, _space_id, _uid, _stars, NULLIF(btrim(COALESCE(_note,'')),''), COALESCE(_new,false))
    ON CONFLICT (user_id, set_id, space_id) WHERE space_id IS NOT NULL
    DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = now();
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rate_question_set(uuid, smallint, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rate_question_set(uuid, smallint, text, uuid) TO authenticated;

-- Rating summary RPC
CREATE OR REPLACE FUNCTION public.question_set_rating_summary(_set_id uuid, _space_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _avg numeric;
  _cnt integer;
  _mine record;
  _b jsonb;
BEGIN
  SELECT ROUND(AVG(stars)::numeric, 2), COUNT(*)
    INTO _avg, _cnt
    FROM public.question_set_ratings
   WHERE set_id = _set_id
     AND ((_space_id IS NULL AND space_id IS NULL) OR (_space_id IS NOT NULL AND space_id = _space_id))
     AND NOT under_review;

  IF _uid IS NOT NULL THEN
    SELECT stars, note INTO _mine FROM public.question_set_ratings
     WHERE set_id = _set_id
       AND user_id = _uid
       AND ((_space_id IS NULL AND space_id IS NULL) OR (_space_id IS NOT NULL AND space_id = _space_id))
     LIMIT 1;
  END IF;

  SELECT COALESCE(jsonb_object_agg(stars, c), '{}'::jsonb) INTO _b FROM (
    SELECT stars, count(*) AS c
      FROM public.question_set_ratings
     WHERE set_id = _set_id
       AND ((_space_id IS NULL AND space_id IS NULL) OR (_space_id IS NOT NULL AND space_id = _space_id))
       AND NOT under_review
     GROUP BY stars
  ) t;

  RETURN jsonb_build_object(
    'avg', COALESCE(_avg, 0),
    'count', COALESCE(_cnt, 0),
    'breakdown', COALESCE(_b, '{}'::jsonb),
    'mine', CASE WHEN _mine.stars IS NOT NULL THEN jsonb_build_object('stars', _mine.stars, 'note', _mine.note) ELSE NULL END
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.question_set_rating_summary(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.question_set_rating_summary(uuid, uuid) TO authenticated;

-- 4. High-Performance Composite Indexes for Millions of Rows
CREATE INDEX IF NOT EXISTS idx_shared_decks_pub_feed ON public.shared_decks (audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_decks_pub_top ON public.shared_decks (audience, published, save_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_decks_owner_today ON public.shared_decks (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_question_sets_pub_feed ON public.shared_question_sets (audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_pub_top ON public.shared_question_sets (audience, published, save_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_pub_rating ON public.shared_question_sets (audience, published, rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_source_feed ON public.shared_question_sets (source_type, audience, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_sets_owner_today ON public.shared_question_sets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_question_items_set_sort ON public.shared_question_items (set_id, sort);

-- FILE: 20260911183000_fix_handle_new_user_phone_and_metadata.sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
  meta_username text;
  meta_phone text;
begin
  meta_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  meta_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    new.id::text
  );

  meta_phone := coalesce(
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    new.phone
  );

  insert into public.profiles (
    id,
    display_name,
    full_name,
    username,
    email,
    phone,
    avatar_url
  )
  values (
    new.id,
    meta_name,
    meta_name,
    meta_username,
    new.email,
    meta_phone,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(trim(excluded.full_name), ''), profiles.full_name),
    username = coalesce(nullif(trim(excluded.username), ''), profiles.username),
    phone = coalesce(nullif(trim(excluded.phone), ''), profiles.phone),
    email = coalesce(excluded.email, profiles.email),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);

  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- FILE: 20260919140000_rita_voice_pipeline.sql
-- Cost-controlled Rita voice sessions. Only server-side service-role code writes usage.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS rita_voice_minutes_monthly integer NOT NULL DEFAULT 0;

UPDATE public.plans
SET rita_voice_minutes_monthly = CASE slug
  WHEN 'starter' THEN 10
  WHEN 'toolkit' THEN 60
  WHEN 'boost' THEN 150
  WHEN 'pro' THEN 360
  WHEN 'ultimate' THEN 1200
  ELSE rita_voice_minutes_monthly
END;

CREATE TABLE IF NOT EXISTS public.rita_voice_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  voice text NOT NULL DEFAULT 'marin',
  response_words integer NOT NULL DEFAULT 55 CHECK (response_words BETWEEN 20 AND 120),
  daily_guard_minutes integer NOT NULL DEFAULT 120 CHECK (daily_guard_minutes BETWEEN 15 AND 720),
  default_monthly_minutes integer NOT NULL DEFAULT 1200 CHECK (default_monthly_minutes BETWEEN 30 AND 10000),
  monthly_budget_cents integer NOT NULL DEFAULT 10000 CHECK (monthly_budget_cents BETWEEN 100 AND 1000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.rita_voice_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rita_voice_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.rita_voice_settings TO authenticated;
GRANT ALL ON public.rita_voice_settings TO service_role;
DROP POLICY IF EXISTS "admins manage rita voice settings" ON public.rita_voice_settings;
CREATE POLICY "admins manage rita voice settings"
  ON public.rita_voice_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.rita_voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personality text NOT NULL DEFAULT 'kind',
  language_preference text NOT NULL DEFAULT 'automatic',
  detected_language text,
  detected_dialect text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  client_label text
);

CREATE INDEX IF NOT EXISTS rita_voice_sessions_user_started_idx
  ON public.rita_voice_sessions (user_id, started_at DESC);
ALTER TABLE public.rita_voice_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rita_voice_sessions TO authenticated;
GRANT ALL ON public.rita_voice_sessions TO service_role;
DROP POLICY IF EXISTS "users read own rita sessions" ON public.rita_voice_sessions;
CREATE POLICY "users read own rita sessions"
  ON public.rita_voice_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.rita_voice_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.rita_voice_sessions(id) ON DELETE SET NULL,
  turn_id uuid NOT NULL DEFAULT gen_random_uuid(),
  input_audio_ms integer NOT NULL DEFAULT 0 CHECK (input_audio_ms >= 0),
  output_audio_ms integer NOT NULL DEFAULT 0 CHECK (output_audio_ms >= 0),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  estimated_cost_micros integer NOT NULL DEFAULT 0 CHECK (estimated_cost_micros >= 0),
  provider text NOT NULL DEFAULT 'openai',
  transcription_model text NOT NULL DEFAULT 'gpt-4o-mini-transcribe',
  response_model text NOT NULL DEFAULT 'gpt-4o-mini',
  speech_model text NOT NULL DEFAULT 'gpt-4o-mini-tts',
  language text,
  dialect text,
  reply_sha256 text,
  premium_voice boolean NOT NULL DEFAULT true,
  speech_generated_at timestamptz,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rita_voice_usage_user_created_idx
  ON public.rita_voice_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rita_voice_usage_session_idx
  ON public.rita_voice_usage (session_id);
ALTER TABLE public.rita_voice_usage ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rita_voice_usage TO authenticated;
GRANT ALL ON public.rita_voice_usage TO service_role;
DROP POLICY IF EXISTS "users read own rita usage" ON public.rita_voice_usage;
CREATE POLICY "users read own rita usage"
  ON public.rita_voice_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- FILE: 20260919150000_rita_response_model_gpt4o_mini.sql
-- Keep Rita's recorded response model aligned with the only runtime model.
ALTER TABLE IF EXISTS public.rita_voice_usage
  ALTER COLUMN response_model SET DEFAULT 'gpt-4o-mini';

-- FILE: 20260921090000_rita_voice_usage_totals.sql
CREATE INDEX IF NOT EXISTS rita_voice_usage_created_idx
  ON public.rita_voice_usage (created_at DESC);

CREATE OR REPLACE FUNCTION public.rita_voice_usage_totals(_user_id uuid)
RETURNS TABLE(used_month_ms bigint, used_today_ms bigint, global_month_micros bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(input_audio_ms + output_audio_ms) FILTER (
      WHERE user_id = _user_id
        AND created_at >= date_trunc('month', now())
    ), 0)::bigint,
    COALESCE(SUM(input_audio_ms + output_audio_ms) FILTER (
      WHERE user_id = _user_id
        AND created_at >= date_trunc('day', now())
    ), 0)::bigint,
    COALESCE(SUM(estimated_cost_micros) FILTER (
      WHERE created_at >= date_trunc('month', now())
    ), 0)::bigint
  FROM public.rita_voice_usage
  WHERE created_at >= date_trunc('month', now())
    AND (user_id = _user_id OR estimated_cost_micros > 0);
$$;

REVOKE ALL ON FUNCTION public.rita_voice_usage_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rita_voice_usage_totals(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rita_voice_usage_totals(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rita_voice_usage_totals(uuid) TO service_role;

-- FILE: 20260923120000_rita_economic_v2_control.sql
-- Rita Economic v2 rollout, stable preferences, and stage timing telemetry.
ALTER TABLE public.rita_voice_settings
  ADD COLUMN IF NOT EXISTS pipeline_mode text NOT NULL DEFAULT 'economic_v2'
    CHECK (pipeline_mode IN ('legacy', 'economic_v2')),
  ADD COLUMN IF NOT EXISTS rollout_percent integer NOT NULL DEFAULT 100
    CHECK (rollout_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS admin_only_preview boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.rita_user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_language text NOT NULL DEFAULT 'unknown',
  active_dialect text NOT NULL DEFAULT 'standard',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rita_user_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rita_user_preferences TO authenticated;
GRANT ALL ON public.rita_user_preferences TO service_role;
DROP POLICY IF EXISTS "users manage own rita preferences" ON public.rita_user_preferences;
CREATE POLICY "users manage own rita preferences"
  ON public.rita_user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.rita_turn_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.rita_voice_sessions(id) ON DELETE SET NULL,
  turn_id uuid,
  pipeline_mode text NOT NULL CHECK (pipeline_mode IN ('legacy', 'economic_v2')),
  language text,
  browser text,
  network_type text,
  speech_end_to_transcript_ms integer,
  transcript_to_first_token_ms integer,
  first_token_to_tts_ms integer,
  speech_end_to_first_audio_ms integer,
  interrupted boolean NOT NULL DEFAULT false,
  fallback_used boolean NOT NULL DEFAULT false,
  error_stage text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rita_turn_metrics_created_idx
  ON public.rita_turn_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS rita_turn_metrics_user_idx
  ON public.rita_turn_metrics (user_id, created_at DESC);
ALTER TABLE public.rita_turn_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rita_turn_metrics TO authenticated;
GRANT ALL ON public.rita_turn_metrics TO service_role;
DROP POLICY IF EXISTS "admins read rita metrics" ON public.rita_turn_metrics;
CREATE POLICY "admins read rita metrics"
  ON public.rita_turn_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

commit;
