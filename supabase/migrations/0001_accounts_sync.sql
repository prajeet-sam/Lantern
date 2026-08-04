-- Lantern: accounts + encrypted sync vaults.
--
-- The server never sees plaintext. A user's dataset is encrypted client-side
-- with AES-256-GCM under a random data key (DEK). The DEK is itself wrapped
-- ("enveloped") under (a) the password-derived key and (b) the recovery key.
-- This table stores only salts, ciphertext, and a revision counter.
--
-- Auth: Supabase Auth, sign-in identifier is a masked email of the form
-- `<username>@lantern.local` (Supabase Auth has no native username provider).
-- The real username lives in `profiles` and is copied from user metadata by
-- the `handle_new_user` trigger. No email is ever sent to that address.

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vaults (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users(id) on delete cascade,
  -- password wrap (encrypts the data key)
  salt                 text not null,
  iterations           integer not null default 200000,
  wrap_password_iv     text not null,
  wrap_password_data   text not null,
  -- recovery wrap (present once a recovery key has been shown)
  recovery_salt        text,
  wrap_recovery_iv     text,
  wrap_recovery_data   text,
  -- the encrypted dataset
  blob_iv              text not null,
  blob_data            text not null,
  rev                  bigint not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- SHA-256 (hex) of the recovery key. Only ever compared server-side.
create table public.recovery_codes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  hash       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vaults enable row level security;
alter table public.recovery_codes enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own vault" on public.vaults
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recovery codes are never readable/writable directly through PostgREST.
create policy "no client access to recovery codes" on public.recovery_codes
  for all using (false) with check (false);

-- ---------------------------------------------------------------------------
-- Signup: create the profile row from user metadata, enforce username
-- uniqueness (defence-in-depth; the masked email already enforces it).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'));
  return new;
exception when unique_violation then
  raise exception 'username already taken';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Recovery-code helpers. Security-definer but every function pins the row to
-- auth.uid(), so a user can only ever touch their own record.
-- ---------------------------------------------------------------------------
create or replace function public.save_recovery_code(p_hash text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.recovery_codes (user_id, hash)
  values (auth.uid(), p_hash)
  on conflict (user_id) do update set hash = excluded.hash, created_at = now();
$$;

create or replace function public.get_recovery_hash()
returns text
language sql security definer set search_path = public
as $$
  select hash from public.recovery_codes where user_id = auth.uid();
$$;

create or replace function public.delete_recovery_code()
returns void
language sql security definer set search_path = public
as $$
  delete from public.recovery_codes where user_id = auth.uid();
$$;

-- The service-role recovery route needs to look up a username -> user mapping.
create or replace function public.user_id_for_username(p_username text)
returns uuid
language sql security definer set search_path = public
as $$
  select id from public.profiles where username = lower(p_username);
$$;

grant execute on function public.handle_new_user() to authenticated;
grant execute on function public.save_recovery_code(text) to authenticated;
grant execute on function public.get_recovery_hash() to authenticated;
grant execute on function public.delete_recovery_code() to authenticated;
grant execute on function public.user_id_for_username(text) to service_role;
