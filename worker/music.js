import { searchCatalog } from '../music/catalog-service.js';
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60, s-maxage=300'};
export default async function handleMusic(request,env,url){
  const path=url.pathname;
  if(path==='/api/music/search')return search(env,url.searchParams.get('q')||'');
  if(path==='/api/music/latest')return catalog(env,'latest');
  const match=path.match(/^\/api\/music\/(song|artist|album)\/([^/]+)$/);if(match)return catalog(env,match[1],match[2]);
  const cover=url.searchParams.get('url');if(path==='/api/music/cover'&&cover)return coverProxy(request,cover);
  const stream=path.match(/^\/api\/music\/stream\/([^/]+)$/);if(stream)return mediaProxy(request,env,stream[1],'audio');
  return json({error:'Music endpoint not found.'},404);
}
async function search(env,q){if(!q.trim())return json({results:[]},200);try{return json(await searchCatalog(env,q),200);}catch(error){console.error('MUSIC_SEARCH_ERROR',error);return json({error:'Music search unavailable.'},502);}}
async function catalog(env,type,value=''){const base=env.MUSIC_SOURCE_API;if(!base)return json({songs:[],artists:[],albums:[],configured:false},200);try{const u=new URL(base);u.pathname=`${u.pathname.replace(/\/$/,'')}/${type}`;if(value)u.searchParams.set('id',value);const r=await fetch(u.toString(),{headers:{Accept:'application/json'}});return new Response(r.body,{status:r.status,headers:{...JSON_HEADERS}})}catch(error){console.error('MUSIC_CATALOG_ERROR',error);return json({error:'Music catalog unavailable.'},502)}}
async function mediaProxy(request,env,id,type){const base=type==='audio'?env.MUSIC_AUDIO_SOURCE:env.MUSIC_COVER_SOURCE;if(!base)return json({error:'Music media source is not configured.'},503);try{const u=new URL(base);u.searchParams.set('id',id);return fetch(u.toString(),{headers:forwardHeaders(request)}).then(r=>mediaResponse(r,type));}catch(error){console.error('MUSIC_MEDIA_ERROR',error);return json({error:'Music media unavailable.'},502)}}
async function coverProxy(request,raw){try{const u=new URL(raw);const host=u.hostname.toLowerCase();const allowed=host==='coverartarchive.org'||host.endsWith('.coverartarchive.org')||host==='theaudiodb.com'||host.endsWith('.theaudiodb.com');if(!allowed)return json({error:'Cover source not allowed.'},403);const r=await fetch(u.toString(),{headers:{Accept:'image/avif,image/webp,image/jpeg,image/png,*/*'}});if(!r.ok)return new Response(null,{status:r.status});const h=new Headers(r.headers);h.set('Cache-Control','public, max-age=86400, s-maxage=604800');h.set('X-Content-Type-Options','nosniff');return new Response(r.body,{status:r.status,headers:h});}catch(e){console.error('MUSIC_COVER_ERROR',e);return json({error:'Cover unavailable.'},502);}}
function forwardHeaders(request){const h=new Headers();for(const key of ['Range','If-None-Match','If-Modified-Since']){const v=request.headers.get(key);if(v)h.set(key,v)}return h;}
function mediaResponse(r,type){const h=new Headers(r.headers);h.set('Cache-Control',type==='cover'?'public, max-age=86400, s-maxage=604800':'public, max-age=60, s-maxage=300');h.set('X-Content-Type-Options','nosniff');return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});}
function json(data,status){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS})}
