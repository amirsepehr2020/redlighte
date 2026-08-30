import { searchMusicBrainz } from './sources/musicbrainz.js';
import { searchTheAudioDB } from './sources/theaudiodb.js';
export async function searchCatalog(env, term) {
  const q = String(term || '').trim();
  if (!q) return { songs: [], artists: [], albums: [], sources: [] };
  const [mbResult, adbResult] = await Promise.allSettled([searchMusicBrainz(q,25), searchTheAudioDB(q,20,env.THEAUDIODB_API_KEY || '123')]);
  const mb = mbResult.status === 'fulfilled' ? mbResult.value : {songs:[],artists:[],albums:[]};
  const adb = adbResult.status === 'fulfilled' ? adbResult.value : {songs:[],artists:[],albums:[]};
  return { songs: dedupe([...mb.songs,...adb.songs]), artists: dedupe([...mb.artists,...adb.artists]), albums: dedupe([...mb.albums,...adb.albums]), sources: [mbResult.status === 'fulfilled' ? 'musicbrainz' : null, adbResult.status === 'fulfilled' ? 'theaudiodb' : null].filter(Boolean) };
}
function dedupe(items){const map=new Map();for(const item of items){const key=item.id || `${item.title||item.name}|${item.artist_name||''}`.toLowerCase();if(!map.has(key))map.set(key,item);}return [...map.values()];}
