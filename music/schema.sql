PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS music_search;
DROP TABLE IF EXISTS sources;
DROP TABLE IF EXISTS songs;
DROP TABLE IF EXISTS albums;
DROP TABLE IF EXISTS artists;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS sync_runs;

CREATE TABLE artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_name TEXT,
  bio TEXT,
  image_url TEXT,
  country TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE genres (id TEXT PRIMARY KEY,name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE);
CREATE TABLE albums (
  id TEXT PRIMARY KEY,title TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,artist_id TEXT,release_date TEXT,cover_url TEXT,source TEXT NOT NULL,source_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
);
CREATE TABLE songs (
  id TEXT PRIMARY KEY,title TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,artist_id TEXT,album_id TEXT,genre_id TEXT,duration INTEGER,release_date TEXT,cover_url TEXT,source TEXT NOT NULL,source_id TEXT,audio_url TEXT,audio_source TEXT,lyrics_url TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE SET NULL
);
CREATE TABLE sources (id TEXT PRIMARY KEY,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,provider TEXT NOT NULL,provider_id TEXT,page_url TEXT,cover_url TEXT,audio_url TEXT,last_checked TEXT,UNIQUE(entity_type,entity_id,provider));
CREATE TABLE sync_runs (id INTEGER PRIMARY KEY AUTOINCREMENT,query TEXT NOT NULL,status TEXT NOT NULL,imported INTEGER NOT NULL DEFAULT 0,started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,finished_at TEXT,error TEXT);
CREATE INDEX idx_artists_name ON artists(name);
CREATE INDEX idx_albums_artist ON albums(artist_id);
CREATE INDEX idx_albums_title ON albums(title);
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_artist ON songs(artist_id);
CREATE INDEX idx_songs_album ON songs(album_id);
CREATE INDEX idx_songs_release ON songs(release_date);
CREATE INDEX idx_sources_entity ON sources(entity_type,entity_id);
CREATE VIRTUAL TABLE music_search USING fts5(entity_id UNINDEXED,entity_type UNINDEXED,title,artist_name,album_name,tokenize='unicode61 remove_diacritics 2');
