CREATE TABLE memberships (
  user_id    BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  group_id   BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  nickname   TEXT   NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 40),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);
CREATE INDEX memberships_group_idx ON memberships (group_id);
