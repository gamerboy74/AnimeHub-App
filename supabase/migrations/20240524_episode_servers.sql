-- Migration: add video_servers JSONB column to episodes table
-- Stores an array of {name, url} server options per episode.
-- The existing video_url column is kept as the primary/default server.
-- video_servers overrides video_url if present and non-empty.
--
-- Example value:
--   [
--     {"name": "Server 1", "url": "https://embed.host1.com/e/abc"},
--     {"name": "Server 2", "url": "https://embed.host2.com/v/abc"},
--     {"name": "Backup",   "url": "https://embed.host3.com/p/abc"}
--   ]

ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS video_servers JSONB DEFAULT '[]'::jsonb;

-- Index for episodes that have server lists (optional, avoids full scan)
CREATE INDEX IF NOT EXISTS idx_episodes_video_servers
  ON episodes USING gin(video_servers);

-- Backfill: if video_url is present, seed Server 1 into video_servers
-- so existing episodes get at least one server entry.
UPDATE episodes
SET video_servers = jsonb_build_array(
  jsonb_build_object('name', 'Server 1', 'url', video_url)
)
WHERE video_url IS NOT NULL
  AND video_url != ''
  AND (video_servers IS NULL OR video_servers = '[]'::jsonb);

COMMENT ON COLUMN episodes.video_servers IS
  'Ordered list of streaming servers: [{name: string, url: string}]. '
  'The player cycles through these when a server fails. '
  'First entry should match video_url for backwards compatibility.';
