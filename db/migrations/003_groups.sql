CREATE TABLE groups (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug               TEXT    NOT NULL UNIQUE,
  name               CITEXT  NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 3 AND 50),
  zone               TEXT    NOT NULL CHECK (zone IN ('norte','oeste','centro','leste','sul')),
  location           TEXT    NOT NULL CHECK (char_length(location) BETWEEN 3 AND 80),
  meeting_point      TEXT    NOT NULL DEFAULT 'Combinado no grupo',
  days               TEXT[]  NOT NULL CHECK (cardinality(days) >= 1
                       AND days <@ ARRAY['seg','ter','qua','qui','sex','sab','dom']),
  start_time         TIME    NOT NULL,
  pace_min_s         INT     NOT NULL CHECK (pace_min_s BETWEEN 180 AND 720),
  pace_max_s         INT     NOT NULL CHECK (pace_max_s BETWEEN 180 AND 720),
  distance           TEXT,
  level              TEXT    NOT NULL CHECK (level IN ('iniciante','intermediario','avancado')),
  base_participants  INT     NOT NULL DEFAULT 1 CHECK (base_participants BETWEEN 1 AND 999),
  description        TEXT    NOT NULL CHECK (char_length(description) BETWEEN 30 AND 400),
  profile_tags       TEXT[]  NOT NULL DEFAULT ARRAY['Novo na plataforma'],
  contact            TEXT,   -- opcional: NULL nos grupos demo; o form de cadastro continua exigindo
  is_demo            BOOLEAN NOT NULL DEFAULT false,
  status             TEXT    NOT NULL DEFAULT 'published'
                       CHECK (status IN ('pending','published','rejected')), -- moderação: v2
  owner_id           BIGINT  REFERENCES users(id) ON DELETE SET NULL,     -- NULL nos grupos demo
  map_pin            INT[],  -- [x,y] no SVG esquemático; NULL = calcular pela zona
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (pace_min_s < pace_max_s)
);
CREATE INDEX groups_zone_idx  ON groups (zone)  WHERE status = 'published';
CREATE INDEX groups_days_idx  ON groups USING GIN (days);
