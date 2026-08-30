import { searchMusicBrainz } from './sources/musicbrainz.js';
import { searchTheAudioDB } from './sources/theaudiodb.js';
export async function searchCatalog(env,term){
  const q=normalizeQuery(term);if(!q)return {results:[]};
  const [mbResult,adbResult]=await Promise.allSettled([searchMusicBrainz(q,25),searchTheAudioDB(q,20,env.THEAUDIODB_API_KEY||'123')]);
  const mb=mbResult.status==='fulfilled'?mbResult.value:{songs:[],artists:[],albums:[]};
  const adb=adbResult.status==='fulfilled'?adbResult.value:{songs:[],artists:[],albums:[]};
  const songs=dedupe([...mb.songs,...adb.songs]).map(x=>({...x,type:'song',title:x.title||'',artist:x.artist_name||'',album:x.album_name||'',coverUrl:x.cover_url||null,audioUrl:x.audio_url||null}));
  const artists=dedupe([...mb.artists,...adb.artists]).map(x=>({...x,type:'artist',title:x.name||'',artist:x.name||'',coverUrl:x.image_url||x.cover_url||null,audioUrl:null}));
  const albums=dedupe([...mb.albums,...adb.albums]).map(x=>({...x,type:'album',title:x.title||'',artist:x.artist_name||'',coverUrl:x.cover_url||null,audioUrl:null}));
  const results=rank([...songs,...artists,...albums],q).slice(0,40);
  return {results,sources:[mbResult.status==='fulfilled'?'musicbrainz':null,adbResult.status==='fulfilled'?'theaudiodb':null].filter(Boolean)};
}
function normalizeQuery(v){return String(v||'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[ۀة]/g,'ه').replace(/\s+/g,' ').trim();}
function dedupe(items){const map=new Map();for(const item of items){const key=String(item.id||`${item.title||item.name}|${item.artist_name||item.name||''}`).toLowerCase();if(!map.has(key))map.set(key,item);}return [...map.values()];}
function rank(items,q){const needle=q.toLowerCase();return items.map((x,i)=>{const title=String(x.title||'').toLowerCase();const artist=String(x.artist||'').toLowerCase();let score=0;if(title===needle||artist===needle)score+=100;if(title.startsWith(needle)||artist.startsWith(needle))score+=60;if(title.includes(needle)||artist.includes(needle))score+=30;if(x.coverUrl)score+=5;if(x.type==='artist'&&artist===needle)score+=20;return {x,score,i};}).sort((a,b)=>b.score-a.score||a.i-b.i).map(v=>v.x);}
