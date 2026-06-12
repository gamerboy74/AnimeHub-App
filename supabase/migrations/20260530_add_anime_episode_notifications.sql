-- ============================================================
-- Migration: Add Triggers for Auto-generating Notifications
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Trigger function for new anime added
CREATE OR REPLACE FUNCTION public.handle_new_anime_notification()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Insert a notification for every registered user
  FOR user_record IN SELECT id FROM public.users LOOP
    INSERT INTO public.notifications (user_id, type, title, message, action_url, data)
    VALUES (
      user_record.id,
      'new_anime',
      'New Anime Added! 🚀',
      NEW.title || ' is now available to stream on AnimeHub. Check it out!',
      '/anime/' || NEW.id,
      jsonb_build_object('anime_id', NEW.id, 'title', NEW.title)
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new anime
DROP TRIGGER IF EXISTS on_new_anime_added ON public.anime;
CREATE TRIGGER on_new_anime_added
  AFTER INSERT ON public.anime
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_anime_notification();


-- 2. Trigger function for new episode added
CREATE OR REPLACE FUNCTION public.handle_new_episode_notification()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
  anime_title text;
BEGIN
  -- Retrieve the title of the anime
  SELECT title INTO anime_title FROM public.anime WHERE id = NEW.anime_id;

  -- Find all users who have this anime in their watchlist or favorites
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM (
      SELECT user_id FROM public.user_watchlist WHERE anime_id = NEW.anime_id
      UNION
      SELECT user_id FROM public.user_favorites WHERE anime_id = NEW.anime_id
    ) AS interested_users
  LOOP
    -- Insert a personalized notification for the user
    INSERT INTO public.notifications (user_id, type, title, message, action_url, data)
    VALUES (
      user_record.id,
      'episode',
      'New Episode Released! 🎬',
      'Episode ' || NEW.episode_number || ' of ' || anime_title || ' is now available.',
      '/watch/' || NEW.id,
      jsonb_build_object('anime_id', NEW.anime_id, 'episode_id', NEW.id, 'episode_number', NEW.episode_number)
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new episode
DROP TRIGGER IF EXISTS on_new_episode_added ON public.episodes;
CREATE TRIGGER on_new_episode_added
  AFTER INSERT ON public.episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_episode_notification();
