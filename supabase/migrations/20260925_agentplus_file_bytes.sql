-- AgentPlus file workspace: per-task byte accounting for the 5MB workspace quota.
ALTER TABLE ap_agent_tasks ADD COLUMN IF NOT EXISTS file_bytes bigint NOT NULL DEFAULT 0;

-- Backfill from latest versions of existing files.
UPDATE ap_agent_tasks t
SET file_bytes = COALESCE((
  SELECT SUM(LENGTH(f.content)) FROM (
    SELECT DISTINCT ON (path) path, content
    FROM ap_agent_files
    WHERE task_id = t.id
    ORDER BY path, version DESC
  ) f
), 0);
