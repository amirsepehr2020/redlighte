export function hasDb(env) {
  return Boolean(env?.MUSIC_DB && typeof env.MUSIC_DB.prepare === 'function');
}

export async function upsertCatalog(env, data) {
  if (!hasDb(env)) return { persisted: false, reason: 'MUSIC_DB binding is not configured' };
  const db = env.MUSIC_DB;
  const artists = data.artists || [];
  const albums = data.albums || [];
  const songs = data.songs || [];
  const statements = [];

  for (const a of artists) statements.push(db.prepare(`INSERT INTO artists (id,name,slug,bio,image_url,country,updated_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,bio=excluded.bio,image_url=excluded.image_url,country=excluded.country,updated_at=CURRENT_TIMESTAMP`).bind(a.id,a.name||'',a.slug||a.name||'',a.bio||null,a.image_url||null,a.country||null));
  for (const a of albums) statements.push(db.prepare(`INSERT INTO albums (id,title,slug,artist_id,release_date,cover_url,updated_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title=excluded.title,slug=excluded.slug,artist_id=excluded.artist_id,release_date=excluded.release_date,cover_url=excluded.cover_url,updated_at=CURRENT_TIMESTAMP`).bind(a.id,a.title||a.name||'',a.slug||a.title||a.name||'',a.artist_id||null,a.release_date||null,a.cover_url||null));
  for (const s of songs) statements.push(db.prepare(`INSERT INTO songs (id,title,slug,artist_id,album_id,duration,release_date,description,lyrics,updated_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title=excluded.title,slug=excluded.slug,artist_id=excluded.artist_id,album_id=excluded.album_id,duration=excluded.duration,release_date=excluded.release_date,description=excluded.description,lyrics=excluded.lyrics,updated_at=CURRENT_TIMESTAMP`).bind(s.id,s.title||'',s.slug||s.title||'',s.artist_id||null,s.album_id||null,s.duration||null,s.release_date||null,s.description||null,s.lyrics||null));
  for (const s of songs) for (const source of s.sources || (s.provider ? [s] : [])) statements.push(db.prepare(`INSERT INTO sources (id,song_id,provider,page_url,audio_url,cover_url,status,last_checked) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET page_url=excluded.page_url,audio_url=excluded.audio_url,cover_url=excluded.cover_url,status=excluded.status,last_checked=CURRENT_TIMESTAMP`).bind(`${s.id}:${source.provider||'unknown'}`,s.id,source.provider||s.provider||'unknown',source.page_url||s.page_url||null,source.audio_url||s.audio_url||null,source.cover_url||s.cover_url||null,source.status||'active'));

  for (let i=0;i<statements.length;i+=50) await db.batch(statements.slice(i,i+50));
  return { persisted: true, artists: artists.length, albums: albums.length, songs: songs.length };
}

export async function searchStored(env, q, limit=25) {
  if (!hasDb(env)) return null;
  const like = `%${q.replace(/[%_]/g,'') }%`;
  const rows = await env.MUSIC_DB.prepare(`SELECT s.id,s.title,s.slug,s.artist_id,s.album_id,s.duration,s.release_date,a.name AS artist_name,al.title AS album_name,al.cover_url FROM songs s LEFT JOIN artists a ON a.id=s.artist_id LEFT JOIN albums al ON al.id=s.album_id WHERE s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ? ORDER BY s.play_count DESC,s.title LIMIT ?`).bind(like,like,like,Math.min(Math.max(Number(limit)||25,1),100)).all();
  return { songs: rows.results || [], artists: [], albums: [], sources: ['redlighte-db'] };
}

export async function getStored(env, type, id) {
  if (!hasDb(env)) return null;
  const table = type === 'song' ? 'songs' : type === 'artist' ? 'artists' : 'albums';
  const row = await env.MUSIC_DB.prepare(`SELECT * FROM ${table} WHERE id=? OR slug=? LIMIT 1`).bind(id,id).first();
  return row || null;
}
