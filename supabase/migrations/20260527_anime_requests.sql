-- ─────────────────────────────────────────────────────────────────
-- Anime Request System
-- Users can request anime to be added. Duplicate titles get merged
-- (vote_count increments) instead of creating new rows.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.anime_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete set null,
  title         text not null,
  mal_id        int  null,                         -- optional: user can paste MAL ID
  notes         text null,
  status        text not null default 'pending'    -- pending | approved | rejected
                check (status in ('pending','approved','rejected')),
  vote_count    int  not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Prevent one user from requesting the same title twice ──────────
-- We case-fold the title so "Naruto" and "naruto" are the same.
create unique index if not exists anime_requests_user_title_uidx
  on public.anime_requests (user_id, lower(trim(title)));

-- ── Index for admin dashboard ordering ────────────────────────────
create index if not exists anime_requests_status_votes_idx
  on public.anime_requests (status, vote_count desc);

-- ── Index for fetching a user's own requests ──────────────────────
create index if not exists anime_requests_user_id_idx
  on public.anime_requests (user_id);

-- ── Auto-update updated_at ─────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists anime_requests_updated_at on public.anime_requests;
create trigger anime_requests_updated_at
  before update on public.anime_requests
  for each row execute function public.touch_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────
alter table public.anime_requests enable row level security;

-- Any authenticated user can INSERT their own request
create policy "Users can insert own requests"
  on public.anime_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can read all pending/approved requests (for the upvote list)
create policy "Anyone can read requests"
  on public.anime_requests for select
  to authenticated
  using (true);

-- Users can update ONLY vote_count on pending rows (upvote other requests)
-- and can update their own rows freely
create policy "Users can upvote or edit own requests"
  on public.anime_requests for update
  to authenticated
  using (auth.uid() = user_id OR status = 'pending')
  with check (auth.uid() = user_id OR status = 'pending');

-- ── Upvote helper function ─────────────────────────────────────────
-- Atomically bumps vote_count. Call via rpc('upvote_anime_request', {request_id})
create or replace function public.upvote_anime_request(request_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.anime_requests
  set vote_count = vote_count + 1
  where id = request_id and status = 'pending';
end;
$$;
