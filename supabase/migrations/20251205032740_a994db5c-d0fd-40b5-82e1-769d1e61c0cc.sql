-- Create table to persist bot conversation states
CREATE TABLE public.bot_user_states (
  id_telegram BIGINT PRIMARY KEY,
  state VARCHAR(50) NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_user_states ENABLE ROW LEVEL SECURITY;

-- Policy for service role only (bot uses service role key)
CREATE POLICY "Service role full access" ON public.bot_user_states
  USING (true)
  WITH CHECK (true);

-- Index for cleanup of old states
CREATE INDEX idx_bot_user_states_updated ON public.bot_user_states(updated_at);

-- Comment
COMMENT ON TABLE public.bot_user_states IS 'Stores Telegram bot conversation states for multi-step flows';