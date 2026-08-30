// Apple Music catalog adapter for Redlighte Music.
// This module only talks to the official Apple Music Catalog API when an
// authorized developer token is supplied by the Worker environment.

const API_ROOT = 'https://api.music.apple.com/v1';

export async function appleSearch(env, storefront, term, limit = 25) {
  if (!env.APPLE_MUSIC_DEVELOPER_TOKEN) {
    throw new Error('APPLE_MUSIC_DEVELOPER_TOKEN is not configured');
  }
  const store = storefront || env.APPLE_MUSIC_STOREFRONT || 'us';
  const url = new URL(`${API_ROOT}/catalog/${encodeURIComponent(store)}/search`);
  url.searchParams.set('term', term);
  url.searchParams.set('limit', String(Math.min(Math.max(Number(limit) || 25, 1), 25)));
  url.searchParams.set('types', 'songs,artists,albums');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.APPLE_MUSIC_DEVELOPER_TOKEN}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) throw new Error(`Apple Music API returned ${response.status}`);
  return normalizeAppleSearch(await response.json());
}

export function normalizeAppleSearch(payload = {}) {
  const data = payload.results || {};
  const artists = (data.artists?.data || []).map(item => ({
    id: `apple:${item.id}`,
    name: item.attributes?.name || '',
    slug: slug(item.attributes?.name),
    bio: '',
    image_url: item.attributes?.artwork?.url || null,
    country: null
  }));

  const albums = (data.albums?.data || []).map(item => ({
    id: `apple:${item.id}`,
    title: item.attributes?.name || '',
    slug: slug(item.attributes?.name),
    artist_id: item.relationships?.artists?.data?.[0]?.id ? `apple:${item.relationships.artists.data[0].id}` : null,
    release_date: item.attributes?.releaseDate || null,
    cover_url: artwork(item.attributes?.artwork)
  }));

  const songs = (data.songs?.data || []).map(item => ({
    id: `apple:${item.id}`,
    title: item.attributes?.name || '',
    slug: slug(item.attributes?.name),
    artist_id: item.attributes?.artistName ? `apple:${slug(item.attributes.artistName)}` : null,
    album_id: item.attributes?.albumName ? `apple:${slug(item.attributes.albumName)}` : null,
    genre_id: null,
    duration: item.attributes?.durationInMillis ? Math.round(item.attributes.durationInMillis / 1000) : null,
    release_date: item.attributes?.releaseDate || null,
    description: '',
    lyrics: '',
    play_count: 0,
    cover_url: artwork(item.attributes?.artwork),
    audio_url: null,
    provider: 'apple-music',
    page_url: item.attributes?.url || null
  }));

  return { artists, albums, songs };
}

function artwork(value) {
  return value?.url ? value.url.replace('{w}', '600').replace('{h}', '600') : null;
}

function slug(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
    .replace(/^-|-$/g, '');
}
