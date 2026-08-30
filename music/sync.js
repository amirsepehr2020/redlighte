import { searchMusicBrainz } from './sources/musicbrainz.js';
import { searchTheAudioDB } from './sources/theaudiodb.js';
import { coverForRelease } from './sources/cover-art.js';

export async function syncTerm(term, env, options = {}) {
  const q = String(term || '').trim();
  if (!q) return emptyResult();
  const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 25);
  const [mb, adb] = await Promise.allSettled([
    searchMusicBrainz(q, limit),
    searchTheAudioDB(q, limit, env?.THEAUDIODB_API_KEY || '123')
  ]);
  const data = merge(
    mb.status === 'fulfilled' ? mb.value : emptyResult(),
    adb.status === 'fulfilled' ? adb.value : emptyResult()
  );
  for (const song of data.songs) {
    if (song.album_id?.startsWith('musicbrainz:')) {
      const cover = await coverForRelease(song.album_id.slice('musicbrainz:'.length));
      if (cover) song.cover_url = cover;
    }
  }
  return data;
}

function merge(a, b) {
  return {
    songs: dedupe([...a.songs, ...b.songs]),
    artists: dedupe([...a.artists, ...b.artists]),
    albums: dedupe([...a.albums, ...b.albums]),
    sources: [...new Set([...(a.sources || ['musicbrainz']), ...(b.sources || ['theaudiodb'])])]
  };
}
function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.id || `${item.title || item.name}|${item.artist_id || item.artist_name || ''}`.toLowerCase();
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}
function emptyResult() { return { songs: [], artists: [], albums: [], sources: [] }; }
