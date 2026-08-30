-- Redlighte Music D1 schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_slug ON artists(slug);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  artist_id TEXT,
  release_date TEXT,
  cover_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_slug ON albums(slug);

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  artist_id TEXT,
  album_id TEXT,
  genre_id TEXT,
  duration INTEGER,
  release_date TEXT,
  description TEXT,
  lyrics TEXT,
  play_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_slug ON songs(slug);
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);

CREATE TABLE IF NOT EXISTS genres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  song_id TEXT,
  provider TEXT NOT NULL,
  page_url TEXT,
  audio_url TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_checked TEXT,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sources_song ON sources(song_id);
CREATE INDEX IF NOT EXISTS idx_sources_provider ON sources(provider);

CREATE VIRTUAL TABLE IF NOT EXISTS music_search USING fts5(
  entity_id UNINDEXED,
  entity_type UNINDEXED,
  title,
  artist_name,
  album_name,
  tokenize='unicode61 remove_diacritics 2'
);
