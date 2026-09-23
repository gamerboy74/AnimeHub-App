-- ============================================================
-- Migration: Optimize Notification Generation, Triggers, & Indexes
-- Solves high database load, timeouts, and table scans with:
-- 1. Set-based batch inserts instead of procedural cursor loops
-- 2. Embedding poster_url & anime metadata directly into notification data
-- 3. Composite and partial indexes for sub-millisecond lookups & badge counting
-- ============================================================

-- 1. Optimized Trigger Function: New Anime Added
-- Uses high-performance set-based INSERT (1 query instead of N procedural loop queries)
-- Directly embeds poster_url so mobile/web clients avoid N+1 secondary queries
CREATE OR REPLACE FUNCTION public.handle_new_anime_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, action_url, data)
  SELECT
    u.id,
    'new_anime',
    'New Anime Added! 🚀',
    NEW.title || ' is now available to stream on AnimeHub. Check it out!',
    '/anime/' || NEW.id,
    jsonb_build_object(
      'anime_id', NEW.id,
      'title', NEW.title,
      'poster_url', NEW.poster_url
    )
  FROM public.users u;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for new anime
DROP TRIGGER IF EXISTS on_new_anime_added ON public.anime;
CREATE TRIGGER on_new_anime_added
  AFTER INSERT ON public.anime
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_anime_notification();


-- 2. Optimized Trigger Function: New Episode Added
-- Uses set-based INSERT DISTINCT for all users with this anime in watchlist or favorites
-- Single query resolution of parent anime poster and title
CREATE OR REPLACE FUNCTION public.handle_new_episode_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_anime_title text;
  v_poster_url  text;
BEGIN
  -- Retrieve the anime's title and poster in a single fast lookup
  SELECT title, poster_url 
  INTO v_anime_title, v_poster_url 
  FROM public.anime 
  WHERE id = NEW.anime_id;

  -- Set-based insert: only 1 SQL statement executed regardless of user count
  INSERT INTO public.notifications (user_id, type, title, message, action_url, data)
  SELECT DISTINCT
    interested.user_id,
    'episode',
    'New Episode Released! 🎬',
    'Episode ' || NEW.episode_number || ' of ' || COALESCE(v_anime_title, 'Anime') || ' is now available.',
    '/watch/' || NEW.id,
    jsonb_build_object(
      'anime_id', NEW.anime_id,
      'episode_id', NEW.id,
      'episode_number', NEW.episode_number,
      'title', v_anime_title,
      'poster_url', v_poster_url
    )
  FROM (
    SELECT user_id FROM public.user_watchlist WHERE anime_id = NEW.anime_id
    UNION
    SELECT user_id FROM public.user_favorites WHERE anime_id = NEW.anime_id
  ) AS interested;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for new episode
DROP TRIGGER IF EXISTS on_new_episode_added ON public.episodes;
CREATE TRIGGER on_new_episode_added
  AFTER INSERT ON public.episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_episode_notification();


-- ============================================================
-- 3. Critical Performance Indexes
-- Eliminates sequential table scans on public.notifications
-- ============================================================

-- Fast chronological notification feed & pagination per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Partial index for instantaneous unread count calculation in headers/badges
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id)
  WHERE read = false;

-- Filter index for notification channel tabs (episode, new_anime, review, system)
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created
  ON public.notifications (user_id, type, created_at DESC);

-- Accelerate episode trigger user resolution
CREATE INDEX IF NOT EXISTS idx_user_watchlist_anime_user
  ON public.user_watchlist (anime_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_anime_user
  ON public.user_favorites (anime_id, user_id);
