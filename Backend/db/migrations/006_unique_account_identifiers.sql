CREATE UNIQUE INDEX IF NOT EXISTS users_name_normalized_key
  ON users (LOWER(BTRIM(name)));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_key
  ON users (LOWER(BTRIM(email)));
