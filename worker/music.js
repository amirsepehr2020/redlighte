import { searchCatalog } from '../music/catalog-service.js';
import { syncTerm } from '../music/sync.js';
import { getStored } from '../music/storage.js';
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60, s-maxage=300','Access-Control-Allow-Origin':'*'};
export default async function handleMusic(request,env,url){
  const path=url.pathname;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Range'}});
  if(path==='/api/music/search')return search(env,url.searchParams.get('q')||'');
  if(path==='/api/music/sync')return sync(env,url.searchParams.get('q')||'');
  if(path==='/api/music/latest')return latest(env,Number(url.searchParams.get('limit')||25));
  const match=path.match(/^\/api\/music\/(song|artist|album)\/([^/]+)$/); if(match)return detail(env,match[1],decodeURIComponent(match[2]));
  const stream=path.match(/^\/api\/music\/stream\/([^/]+)$/); if(stream)return mediaProxy(request,env,decodeURIComponent(stream[1]),'audio');
  const cover=path.match(/^\/api\/music\/cover\/([^/]+)$/); if(cover)return mediaProxy(request,env,decodeURIComponent(cover[1]),'cover');
  return json({error:'Music endpoint not found.'},404);
}
async function search(env,q){if(!q.trim())return json({songs:[],artists:[],albums:[],sources:[]},200);try{return json(await searchCatalog(env,q),200);}catch(error){console.error('MUSIC_SEARCH_ERROR',error);return json({error:'Music search unavailable.'},502);}}
async function sync(env,q){if(!q.trim())return json({error:'Query is required.'},400);try{return json(await syncTerm(q,env),200);}catch(error){console.error('MUSIC_SYNC_ERROR',error);return json({error:'Music sync unavailable.'},502);}}
async function detail(env,type,id){try{const row=await getStored(env,type,id);if(row)return json({type,data:row,source:'redlighte-db'},200);return json({type,id,configured:Boolean(env.MUSIC_SOURCE_API)},200);}catch(error){console.error('MUSIC_DETAIL_ERROR',error);return json({error:'Music detail unavailable.'},502);}}
async function latest(env,limit){if(env?.MUSIC_DB?.prepare){try{const n=Math.min(Math.max(limit||25,1),100);const rows=await env.MUSIC_DB.prepare('SELECT s.id,s.title,s.slug,s.artist_id,s.album_id,s.duration,s.release_date,a.name AS artist_name,al.title AS album_name,al.cover_url FROM songs s LEFT JOIN artists a ON a.id=s.artist_id LEFT JOIN albums al ON al.id=s.album_id ORDER BY s.created_at DESC LIMIT ?').bind(n).all();return json({songs:rows.results||[],artists:[],albums:[],sources:['redlighte-db']},200);}catch(error){console.error('MUSIC_LATEST_ERROR',error);}}return json({songs:[],artists:[],albums:[],sources:[],configured:false},200);}
async function mediaProxy(request,env,id,type){const base=type==='audio'?env.MUSIC_AUDIO_SOURCE:env.MUSIC_COVER_SOURCE;if(!base)return json({error:'Music media source is not configured.'},503);try{const u=new URL(base);u.searchParams.set('id',id);const headers=new Headers();for(const key of ['Range','If-None-Match','If-Modified-Since']){const v=request.headers.get(key);if(v)headers.set(key,v)}const r=await fetch(u.toString(),{headers});const out=new Headers(r.headers);out.set('Cache-Control',type==='cover'?'public, max-age=86400, s-maxage=604800':'public, max-age=60, s-maxage=300');out.set('Access-Control-Allow-Origin','*');out.set('X-Content-Type-Options','nosniff');return new Response(r.body,{status:r.status,statusText:r.statusText,headers:out});}catch(error){console.error('MUSIC_MEDIA_ERROR',error);return json({error:'Music media unavailable.'},502);}}
function json(data,status){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
