const API_ROOT = 'https://www.theaudiodb.com/api/v1/json';
const DEFAULT_KEY = '123';
export async function searchTheAudioDB(term, limit = 20, apiKey = DEFAULT_KEY) {
  const key = apiKey || DEFAULT_KEY;
  const url = `${API_ROOT}/${encodeURIComponent(key)}/search.php?s=${encodeURIComponent(term)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`TheAudioDB returned ${response.status}`);
  return normalize(await response.json(), limit);
}
function normalize(data = {}, limit = 20) {
  const artists = (data.artists || []).slice(0, limit).map(a => ({ id:`theaudiodb:${a.idArtist}`, name:a.strArtist||'', slug:slug(a.strArtist), bio:a.strBiographyEN||'', image_url:a.strArtistThumb||a.strArtistFanart||null, country:a.strCountry||null }));
  return { artists, albums: [], songs: [] };
}
function slug(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi,'-').replace(/^-|-$/g,'');}
