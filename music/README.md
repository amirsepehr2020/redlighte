# Redlighte Music

## Architecture

```text
Sources -> Normalize -> Deduplicate -> Catalog -> API -> UI
                    |-> Cover Art

Metadata sources:
- MusicBrainz: recordings, artists and release metadata
- Cover Art Archive: release artwork
- TheAudioDB: artist metadata and artwork

Playback is intentionally separate from metadata. No audio files are downloaded into this repository.
```

## API

- `GET /api/music/search?q=` — unified catalog search
- `GET /api/music/latest` — catalog/latest adapter hook
- `GET /api/music/song/:id` — song adapter hook
- `GET /api/music/artist/:id` — artist adapter hook
- `GET /api/music/album/:id` — album adapter hook
- `GET /api/music/cover/:id` — cover proxy hook
- `GET /api/music/stream/:id` — playback proxy hook; requires a permitted source

## Data flow

`music/sync.js` fetches metadata, normalizes it through source adapters, merges duplicate records, and enriches MusicBrainz releases with Cover Art Archive artwork.

The current catalog file is a schema/seed structure only. It must not be populated with invented tracks.

## Production rules

1. Keep source credentials out of source control.
2. Respect upstream rate limits and attribution/terms.
3. Cache metadata and artwork where permitted.
4. Do not download or mirror copyrighted audio without the required rights.
5. Keep playback as a replaceable adapter so a licensed provider can be added later.
