# Redlighte Music

Production-oriented music catalog layer for Redlighte. This module owns only Music functionality.

## Sources

- MusicBrainz: primary open metadata source; no API key.
- Cover Art Archive: artwork for MusicBrainz releases; no API key.
- TheAudioDB: secondary metadata/artwork source; Free API uses key `123` unless `THEAUDIODB_API_KEY` is configured.

No audio files are stored in this repository.

## D1 production setup

Create a Cloudflare D1 database and bind it to the Worker with the exact variable name:

`MUSIC_DB`

The current database created for this deployment is expected to be named `prod-d1-tutorial`.

Run `music/d1-schema.sql` against that database before using persistent catalog storage. The Wrangler configuration still needs the real Cloudflare D1 `database_id`; that value is account-specific and must not be guessed or committed as a placeholder.

Optional environment variable:

- `THEAUDIODB_API_KEY`

## Runtime endpoints

- `GET /api/music/search?q=...` — database-first search; falls back to live MusicBrainz/TheAudioDB when no stored songs are found.
- `GET /api/music/sync?q=...` — fetch, normalize, cover-enrich and persist results when D1 is configured.
- `GET /api/music/latest?limit=25` — latest persisted songs.
- `GET /api/music/song/:id`
- `GET /api/music/artist/:id`
- `GET /api/music/album/:id`
- `GET /api/music/cover/:id` — proxy only when `MUSIC_COVER_SOURCE` is configured.
- `GET /api/music/stream/:id` — proxy only when `MUSIC_AUDIO_SOURCE` is configured.

## Data flow

Source APIs -> normalization -> deduplication -> D1 persistence -> database-first search -> Music API -> UI.

The catalog is metadata-first. Audio playback must use a separately authorized source; catalog providers are not treated as MP3 hosting services.

## First production test

After applying the D1 schema and deploying the Worker, test:

`/api/music/sync?q=The%20Weeknd`

Then:

`/api/music/search?q=The%20Weeknd`

The sync response should report `persisted: true` and counts for artists/albums/songs. The search response should report `redlighte-db` as its source after data has been persisted.
