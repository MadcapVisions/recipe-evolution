-- recipe_feedback: stores explicit per-recipe feedback from users
CREATE TABLE IF NOT EXISTS recipe_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_version_id uuid NOT NULL REFERENCES recipe_versions(id) ON DELETE CASCADE,
  signal text NOT NULL CHECK (signal IN ('thumbs_up', 'thumbs_down')),
  reason text CHECK (reason IN ('too_heavy', 'too_spicy', 'dont_like_ingredients', 'not_what_i_wanted')),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE recipe_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage own feedback"
  ON recipe_feedback
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- One feedback entry per user per version (upsert replaces on signal change)
CREATE UNIQUE INDEX idx_recipe_feedback_owner_version ON recipe_feedback(owner_id, recipe_version_id);
CREATE INDEX idx_recipe_feedback_owner ON recipe_feedback(owner_id);
CREATE INDEX idx_recipe_feedback_version ON recipe_feedback(recipe_version_id);

-- user_taste_scores: score-based taste model, updated from feedback
CREATE TABLE IF NOT EXISTS user_taste_scores (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  scores_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_taste_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage own taste scores"
  ON user_taste_scores
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
