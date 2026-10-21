-- Schwimmgrüppchen – D1 Schema (SQLite)
CREATE TABLE IF NOT EXISTS members (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'de',
  active      INTEGER NOT NULL DEFAULT 1,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  invited_by  INTEGER REFERENCES members(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_members_token ON members(token);

-- Tagesstatus: pro Tag (Europe/Madrid) und Person. Neuer Tag = neue Zeile, daher automatischer Reset um 00:00.
CREATE TABLE IF NOT EXISTS attendance (
  day         TEXT NOT NULL,                 -- YYYY-MM-DD
  member_id   INTEGER NOT NULL REFERENCES members(id),
  status      TEXT NOT NULL CHECK (status IN ('yes','no','away')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (day, member_id)
);

-- Treffzeit pro Tag (Vorschlag)
CREATE TABLE IF NOT EXISTS day_settings (
  day           TEXT PRIMARY KEY,
  meet_time     TEXT NOT NULL,               -- HH:MM
  proposed_by   INTEGER REFERENCES members(id),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Pinnwand
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER REFERENCES members(id),
  kind        TEXT NOT NULL DEFAULT 'msg' CHECK (kind IN ('msg','system')),
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Quallenmeldungen vor Ort
CREATE TABLE IF NOT EXISTS jelly_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  day         TEXT NOT NULL,
  bay         TEXT NOT NULL,
  member_id   INTEGER REFERENCES members(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_jelly_day ON jelly_reports(day, bay);
