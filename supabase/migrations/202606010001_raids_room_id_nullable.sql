-- Allow global raids (launched from Communities hub, not a room)
ALTER TABLE community_raids
  ALTER COLUMN room_id DROP NOT NULL,
  ALTER COLUMN room_id DROP DEFAULT;
