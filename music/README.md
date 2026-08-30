# Redlighte Music

Production-oriented music catalog layer for Redlighte. This module owns only Music functionality.

## Sources

- MusicBrainz: primary open metadata source; no API key.
- Cover Art Archive: artwork for MusicBrainz releases; no API key.
- TheAudioDB: secondary metadata/artwork source; Free API uses key `123` unless `THEAUDIODB_API_KEY` is configured.

No audio files are stored in this repository.

## Runtime

The Worker supports live search without a database. For persistent catalog storage, create a Cloudflare D1 database and bind it to the Worker as `MUSIC_DB`, then execute `music/d1-schema.sql` against that database.

Optional environment variable:

- `THEAUDIODB_API_KEY`

Playback is deliberately separate. `MUSIC_AUDIO_SOURCE` is only a proxy target for a source that you are authorized to stream.

## Endpoints

- `GET /api/music/search?q=...` — live catalog search; uses stored data first when D1 is configured.
- `GET /api/music/sync?q=...` — fetch, normalize, cover-enrich and persist results when D1 is configured.
- `GET /api/music/latest?limit=25` — latest persisted songs.
- `GET /api/music/song/:id`
- `GET /api/music/artist/:id`
- `GET /api/music/album/:id`
- `GET /api/music/cover/:id` — proxy only when `MUSIC_COVER_SOURCE` is configured.
- `GET /api/music/stream/:id` — proxy only when `MUSIC_AUDIO_SOURCE` is configured.

## Data flow

Source APIs -> normalization -> deduplication -> optional D1 persistence -> Music API -> UI.

The catalog is metadata-first. Audio playback must use a separately authorized source; catalog providers are not treated as MP3 hosting services.
