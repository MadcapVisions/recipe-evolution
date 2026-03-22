-- Track per-call AI usage (tokens + cost) for every route, keyed by user.
-- Used by the admin dashboard to show cost per account.

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route      text        NOT NULL,
  model      text,
  input_tokens  integer,
  output_tokens integer,
  cost_usd   float8,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users may insert their own rows (the server uses their session client).
-- No user SELECT policy — only the service-role admin reads this table.
CREATE POLICY "Users can insert own usage" ON ai_usage_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX ai_usage_log_user_created_idx ON ai_usage_log (user_id, created_at DESC);
CREATE INDEX ai_usage_log_route_created_idx ON ai_usage_log (route, created_at DESC);
