// Redlighte Music catalog importer utilities.
// Source-specific fetching stays outside this module; only normalized records enter the catalog.

export function normalizeRecord(input = {}) {
  const artist = input.artist || {};
  const album = input.album || {};
  const song = input.song || input;
  const slug = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-').replace(/^-|-$/g, '');
  return {
    artist: { id: artist.id || null, name: String(artist.name || '').trim(), slug: artist.slug || slug(artist.name) },
    album: { id: album.id || null, title: String(album.title || '').trim(), slug: album.slug || slug(album.title), artist_id: artist.id || album.artist_id || null, release_date: album.release_date || null, cover_url: album.cover_url || null },
    song: { id: song.id || null, title: String(song.title || '').trim(), slug: song.slug || slug(song.title), artist_id: artist.id || song.artist_id || null, album_id: album.id || song.album_id || null, genre_id: song.genre_id || null, duration: Number.isFinite(Number(song.duration)) ? Number(song.duration) : null, release_date: song.release_date || null, description: song.description || '', lyrics: song.lyrics || '', play_count: Number(song.play_count || 0) },
    source: { provider: song.provider || input.provider || null, page_url: song.page_url || input.page_url || null, audio_url: song.audio_url || input.audio_url || null, cover_url: song.cover_url || input.cover_url || null }
  };
}

export function dedupeKey(record) {
  const r = normalizeRecord(record);
  return [r.song.artist_id || r.artist.slug, r.song.title.toLowerCase(), r.song.album_id || r.album.slug].join('|');
}

export function mergeCatalog(catalog, records = []) {
  const result = structuredClone(catalog || { version: 1, artists: [], albums: [], songs: [], genres: [], sources: [] });
  const seen = new Set(result.songs.map(s => [s.artist_id || '', String(s.title || '').toLowerCase(), s.album_id || ''].join('|')));
  for (const raw of records) {
    const r = normalizeRecord(raw);
    if (!r.song.title || !r.artist.name) continue;
    if (!seen.has(dedupeKey(r))) {
      if (r.artist.id && !result.artists.some(a => a.id === r.artist.id)) result.artists.push(r.artist);
      if (r.album.id && !result.albums.some(a => a.id === r.album.id)) result.albums.push(r.album);
      result.songs.push(r.song);
      result.sources.push({ id: `${r.song.id || r.song.slug}:${r.source.provider || 'unknown'}`, song_id: r.song.id || r.song.slug, ...r.source, status: 'active', last_checked: new Date().toISOString() });
      seen.add(dedupeKey(r));
    }
  }
  return result;
}
