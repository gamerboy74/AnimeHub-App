-- ─────────────────────────────────────────────────────────────────
-- Enforce Single Upvote Constraint Per User
-- Creates a request votes mapping table to track who upvoted what
-- and updates the upvote RPC to atomically enforce this limit.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.anime_request_votes (
  request_id uuid references public.anime_requests(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  primary key (request_id, user_id)
);

-- Row Level Security
alter table public.anime_request_votes enable row level security;

create policy "Users can insert own votes"
  on public.anime_request_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Anyone can read votes"
  on public.anime_request_votes for select
  to authenticated
  using (true);

-- Atomically bumps vote_count if not already upvoted
create or replace function public.upvote_anime_request(request_id uuid)
returns void language plpgsql security definer as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Insert tracking row. If user already upvoted this request_id, 
  -- unique index constraint will fail and throw exception
  insert into public.anime_request_votes (request_id, user_id)
  values (request_id, current_user_id);

  -- Bump the count
  update public.anime_requests
  set vote_count = vote_count + 1
  where id = request_id and status = 'pending';
end;
$$;
