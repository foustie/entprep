-- Arena: multiplayer quiz sessions (Kahoot-style, up to 30 players)

CREATE TABLE IF NOT EXISTS arenas (
  id SERIAL PRIMARY KEY,
  code VARCHAR(6) NOT NULL,
  subject TEXT NOT NULL,
  host_id UUID NOT NULL REFERENCES auth.users(id),
  question_ids JSONB NOT NULL DEFAULT '[]',
  question_count INT NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'lobby',
  current_question INT NOT NULL DEFAULT 0,
  question_started_at TIMESTAMPTZ,
  max_players INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes')
);

CREATE TABLE IF NOT EXISTS arena_players (
  id SERIAL PRIMARY KEY,
  arena_id INT NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  nickname TEXT,
  avatar_url TEXT,
  answers JSONB NOT NULL DEFAULT '{}',
  score INT NOT NULL DEFAULT 0,
  answer_times JSONB NOT NULL DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(arena_id, user_id)
);

-- Indexes
CREATE INDEX idx_arenas_code ON arenas(code) WHERE status = 'lobby';
CREATE INDEX idx_arenas_status ON arenas(status, created_at);
CREATE INDEX idx_arena_players_arena ON arena_players(arena_id);
CREATE INDEX idx_arena_players_user ON arena_players(user_id);

-- RLS
ALTER TABLE arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_players ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read arenas they're part of
CREATE POLICY "Users can read arenas" ON arenas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read arena_players" ON arena_players FOR SELECT TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE arenas;
