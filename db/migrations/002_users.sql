CREATE TABLE users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          CITEXT NOT NULL UNIQUE,
  password_hash  TEXT   NOT NULL,
  display_name   TEXT   NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
  role           TEXT   NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
