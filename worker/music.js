const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60, s-maxage=300'};
export default async function handleMusic(request,env,url){
  const path=url.pathname;
  if(path==='/api/music/latest')return catalog(request,env,'latest');
  if(path==='/api/music/search')return catalog(request,env,'search',url.searchParams.get('q')||'');
  const match=path.match(/^\/api\/music\/(song|artist|album)\/([^/]+)$/);
  if(match)return catalog(request,env,match[1],match[2]);
  const stream=path.match(/^\/api\/music\/stream\/([^/]+)$/);
  if(stream)return mediaProxy(request,env,stream[1],'audio');
  const cover=path.match(/^\/api\/music\/cover\/([^/]+)$/);
  if(cover)return mediaProxy(request,env,cover[1],'cover');
  return json({error:'Music endpoint not found.'},404);
}
async function catalog(request,env,type,value=''){
  const base=env.MUSIC_SOURCE_API;
  if(!base)return json({songs:[],artists:[],albums:[],configured:false},200);
  try{const u=new URL(base);u.pathname=`${u.pathname.replace(/\/$/,'')}/${type}`;if(type==='search')u.searchParams.set('q',value);else if(value)u.searchParams.set('id',value);const r=await fetch(u.toString(),{headers:{Accept:'application/json'}});return new Response(r.body,{status:r.status,headers:{...JSON_HEADERS}})}catch(error){console.error('MUSIC_CATALOG_ERROR',error);return json({error:'Music catalog unavailable.'},502)}}
async function mediaProxy(request,env,id,type){
  const base=type==='audio'?env.MUSIC_AUDIO_SOURCE:env.MUSIC_COVER_SOURCE;
  if(!base)return json({error:'Music media source is not configured.'},503);
  try{const u=new URL(base);u.searchParams.set('id',id);const headers=new Headers();for(const key of ['Range','If-None-Match','If-Modified-Since']){const v=request.headers.get(key);if(v)headers.set(key,v)}const r=await fetch(u.toString(),{headers});const out=new Headers(r.headers);out.set('Cache-Control',type==='cover'?'public, max-age=86400, s-maxage=604800':'public, max-age=60, s-maxage=300');out.set('X-Content-Type-Options','nosniff');return new Response(r.body,{status:r.status,statusText:r.statusText,headers:out})}catch(error){console.error('MUSIC_MEDIA_ERROR',error);return json({error:'Music media unavailable.'},502)}}
function json(data,status){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS})}
