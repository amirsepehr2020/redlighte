import { searchMusicBrainz } from './sources/musicbrainz.js';
import { searchTheAudioDB } from './sources/theaudiodb.js';

const ITUNES_API = 'https://itunes.apple.com/search';

export async function searchCatalog(env, term) {
  const q = normalizeQuery(term);
  if (!q) return { results: [] };

  const [mbResult, adbResult, itunesResult] = await Promise.allSettled([
    searchMusicBrainz(q, 25),
    searchTheAudioDB(q, 20, env.THEAUDIODB_API_KEY || '123'),
    searchITunes(q, 25),
  ]);

  const mb = mbResult.status === 'fulfilled' ? mbResult.value : { songs: [], artists: [], albums: [] };
  const adb = adbResult.status === 'fulfilled' ? adbResult.value : { songs: [], artists: [], albums: [] };
  const itunes = itunesResult.status === 'fulfilled' ? itunesResult.value : { songs: [], artists: [], albums: [] };

  const songs = dedupe([...itunes.songs, ...mb.songs, ...adb.songs])
    .map(x => ({
      ...x,
      type: 'song',
      title: x.title || '',
      artist: x.artist_name || '',
      album: x.album_name || '',
      coverUrl: x.cover_url || null,
      audioUrl: x.audio_url || null,
    }));

  const artists = dedupe([...mb.artists, ...adb.artists, ...itunes.artists])
    .map(x => ({
      ...x,
      type: 'artist',
      title: x.name || '',
      artist: x.name || '',
      coverUrl: x.image_url || x.cover_url || null,
      audioUrl: null,
    }));

  const albums = dedupe([...mb.albums, ...adb.albums, ...itunes.albums])
    .map(x => ({
      ...x,
      type: 'album',
      title: x.title || '',
      artist: x.artist_name || '',
      coverUrl: x.cover_url || null,
      audioUrl: null,
    }));

  // iTunes is a real preview source, so prefer its playable result when the
  // catalog metadata matches but MusicBrainz did not provide audio.
  const enrichedSongs = await enrichSongPreviews(songs);
  const results = rank([...enrichedSongs, ...artists, ...albums], q).slice(0, 40);

  return {
    results,
    sources: [
      mbResult.status === 'fulfilled' ? 'musicbrainz' : null,
      adbResult.status === 'fulfilled' ? 'theaudiodb' : null,
      itunesResult.status === 'fulfilled' ? 'itunes' : null,
    ].filter(Boolean),
  };
}

async function searchITunes(term, limit = 25) {
  const url = new URL(ITUNES_API);
  url.searchParams.set('term', term);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', String(Math.min(Math.max(Number(limit) || 25, 1), 50)));
  url.searchParams.set('country', 'US');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`iTunes returned ${response.status}`);

  const data = await response.json();
  const songs = (data.results || [])
    .filter(item => item.trackName)
    .map(item => ({
      id: `itunes:${item.trackId}`,
      title: item.trackName || '',
      slug: slug(item.trackName),
      artist_id: item.artistId ? `itunes:${item.artistId}` : null,
      artist_name: item.artistName || '',
      album_id: item.collectionId ? `itunes:${item.collectionId}` : null,
      album_name: item.collectionName || '',
      duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : null,
      release_date: item.releaseDate || null,
      provider: 'itunes',
      page_url: item.trackViewUrl || null,
      cover_url: upgradeArtwork(item.artworkUrl100 || null),
      audio_url: item.previewUrl || null,
    }));
  return { songs, artists: [], albums: [] };
}

async function enrichSongPreviews(songs) {
  const output = await Promise.all(songs.map(async song => {
    if (song.audioUrl) return song;
    const preview = await findITunesPreview(song.title, song.artist).catch(() => null);
    return preview ? { ...song, audioUrl: preview } : song;
  }));
  return output;
}

async function findITunesPreview(title, artist) {
  if (!title) return null;
  const term = [artist, title].filter(Boolean).join(' ');
  const url = new URL(ITUNES_API);
  url.searchParams.set('term', term);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', '10');
  url.searchParams.set('country', 'US');

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const data = await response.json();
  const targetTitle = normalizeQuery(title).replace(/\s+/g, ' ');
  const targetArtist = normalizeQuery(artist || '').replace(/\s+/g, ' ');
  const candidates = (data.results || []).filter(x => x.previewUrl);

  const exact = candidates.find(x =>
    normalizeQuery(x.trackName || '').replace(/\s+/g, ' ') === targetTitle &&
    (!targetArtist || normalizeQuery(x.artistName || '').replace(/\s+/g, ' ') === targetArtist)
  );
  if (exact?.previewUrl) return exact.previewUrl;

  const artistMatch = candidates.find(x =>
    targetArtist &&
    normalizeQuery(x.artistName || '').replace(/\s+/g, ' ') === targetArtist &&
    normalizeQuery(x.trackName || '').replace(/\s+/g, ' ').includes(targetTitle)
  );
  if (artistMatch?.previewUrl) return artistMatch.previewUrl;

  const titleMatch = candidates.find(x => normalizeQuery(x.trackName || '').replace(/\s+/g, ' ') === targetTitle);
  return titleMatch?.previewUrl || null;
}

function upgradeArtwork(url) {
  return url ? url.replace(/100x100bb\./i, '600x600bb.') : null;
}

function normalizeQuery(v) {
  return String(v || '')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    const key = String(item.id || `${item.title || item.name}|${item.artist_name || item.name || ''}`).toLowerCase();
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function rank(items, q) {
  const needle = normalizeQuery(q).toLowerCase();
  return items
    .map((x, i) => {
      const title = normalizeQuery(x.title || '').toLowerCase();
      const artist = normalizeQuery(x.artist || '').toLowerCase();
      let score = 0;
      if (title === needle || artist === needle) score += 100;
      if (title.startsWith(needle) || artist.startsWith(needle)) score += 60;
      if (title.includes(needle) || artist.includes(needle)) score += 30;
      if (x.coverUrl) score += 5;
      if (x.audioUrl) score += 8;
      if (x.type === 'artist' && artist === needle) score += 20;
      return { x, score, i };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(v => v.x);
}

function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-').replace(/^-|-$/g, '');
}
