-- X (Twitter) integration tables
-- Stores user X/Twitter connections and credentials

-- Create x_connections table
CREATE TABLE IF NOT EXISTS x_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  x_user_id VARCHAR(255) NOT NULL,
  x_username VARCHAR(255) NOT NULL,
  x_access_token TEXT NOT NULL,
  x_refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id),
  UNIQUE(x_user_id)
);

-- Create x_posts table for tracking posted content
CREATE TABLE IF NOT EXISTS x_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  x_connection_id UUID NOT NULL REFERENCES x_connections(id) ON DELETE CASCADE,
  
  -- X/Twitter specific data
  x_tweet_id VARCHAR(255) UNIQUE NOT NULL,
  x_text TEXT NOT NULL,
  x_media_ids TEXT[], -- JSON array of media IDs
  
  -- Content generation metadata
  generated_by_claude BOOLEAN DEFAULT FALSE,
  claude_prompt TEXT, -- Original prompt sent to Claude
  original_text TEXT, -- Before any refinements
  
  -- Image generation metadata
  image_urls TEXT[], -- URLs of generated images uploaded to X
  fal_image_urls TEXT[], -- Original Fal-generated URLs
  fal_model VARCHAR(255), -- Which Fal model was used
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'published', -- published, failed, deleted
  error_message TEXT,
  
  -- Engagement tracking
  like_count INT DEFAULT 0,
  retweet_count INT DEFAULT 0,
  reply_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  last_engagement_check TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create x_post_generation_logs table
CREATE TABLE IF NOT EXISTS x_post_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Generation parameters
  topic TEXT NOT NULL,
  tone VARCHAR(50), -- professional, casual, humorous, marketing
  max_length INT,
  include_hashtags BOOLEAN DEFAULT TRUE,
  include_emoji BOOLEAN DEFAULT TRUE,
  
  -- Generated content
  generated_post TEXT,
  variations TEXT[], -- Array of alternative posts
  
  -- Image generation
  image_description TEXT,
  generated_image_url TEXT,
  fal_model VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'success', -- success, failed
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create x_post_schedules table for scheduling posts
CREATE TABLE IF NOT EXISTS x_post_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Post content
  post_text TEXT NOT NULL,
  image_urls TEXT[], -- URLs to attach
  
  -- Schedule
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, published, failed, cancelled
  
  -- Publishing metadata
  published_x_tweet_id VARCHAR(255),
  published_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_x_connections_user_id ON x_connections(user_id);
CREATE INDEX idx_x_connections_x_user_id ON x_connections(x_user_id);
CREATE INDEX idx_x_posts_agent_id ON x_posts(agent_id);
CREATE INDEX idx_x_posts_user_id ON x_posts(user_id);
CREATE INDEX idx_x_posts_created_at ON x_posts(created_at DESC);
CREATE INDEX idx_x_posts_status ON x_posts(status);
CREATE INDEX idx_x_post_generation_logs_agent_id ON x_post_generation_logs(agent_id);
CREATE INDEX idx_x_post_generation_logs_created_at ON x_post_generation_logs(created_at DESC);
CREATE INDEX idx_x_post_schedules_agent_id ON x_post_schedules(agent_id);
CREATE INDEX idx_x_post_schedules_scheduled_for ON x_post_schedules(scheduled_for);
CREATE INDEX idx_x_post_schedules_status ON x_post_schedules(status);

-- Enable RLS
ALTER TABLE x_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE x_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE x_post_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE x_post_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- x_connections: Users can only see their own X connections
CREATE POLICY x_connections_user_isolation ON x_connections
  FOR ALL USING (user_id = current_user_id());

-- x_posts: Users can only see their agents' posts
CREATE POLICY x_posts_agent_isolation ON x_posts
  FOR ALL USING (
    user_id = current_user_id() OR 
    agent_id IN (SELECT id FROM agents WHERE user_id = current_user_id())
  );

-- x_post_generation_logs: Users can only see their agents' logs
CREATE POLICY x_post_generation_logs_agent_isolation ON x_post_generation_logs
  FOR ALL USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = current_user_id())
  );

-- x_post_schedules: Users can only see their scheduled posts
CREATE POLICY x_post_schedules_user_isolation ON x_post_schedules
  FOR ALL USING (user_id = current_user_id());
