const DATA_REPO='amirsepehr2020/redlighte-data';

export async function handleGame(request,env,url){
  const cors=corsHeaders(request);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const session=await readSession(request,env);
  if(!session)return json({error:'Unauthorized.'},401,cors);
  const path=`users/${session.username}/game.json`;
  try{
    const file=await githubFile(env,path);
    if(request.method==='GET'){
      const data=file?JSON.parse(file.content):defaultGame();
      return json({game:data},200,cors);
    }
    if(request.method!=='PUT')return json({error:'Method not allowed.'},405,{...cors,Allow:'GET,PUT,OPTIONS'});
    const body=await request.json();
    const game=sanitizeGame(body?.game);
    await githubWrite(env,path,game,file?.sha||null,'Update game progress');
    return json({ok:true,game},200,cors);
  }catch(error){
    console.error('GAME_API_ERROR',error);
    return json({error:'Game service error.'},500,cors);
  }
}

function defaultGame(){return {gamesPlayed:0,wins:0,streak:0,xp:0,achievements:[],playedOriginals:[]}}
function sanitizeGame(value){
  const d=defaultGame(),x=value&&typeof value==='object'?value:{};
  d.gamesPlayed=number(x.gamesPlayed);d.wins=number(x.wins);d.streak=number(x.streak);d.xp=number(x.xp);
  d.achievements=Array.isArray(x.achievements)?x.achievements.filter(v=>typeof v==='string').slice(0,100):[];
  d.playedOriginals=Array.isArray(x.playedOriginals)?x.playedOriginals.filter(v=>typeof v==='string').slice(0,50):[];
  return d;
}
function number(v){const n=Number(v);return Number.isFinite(n)&&n>=0?Math.floor(n):0}
async function githubFile(env,path){const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}?ref=main`,{headers:githubHeaders(env)});if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub GET ${r.status}`);const x=await r.json();const bytes=Uint8Array.from(atob(x.content.replace(/\n/g,'')),c=>c.charCodeAt(0));return{sha:x.sha,content:new TextDecoder().decode(bytes)}}
async function githubWrite(env,path,data,sha,message){const content=btoa(unescape(encodeURIComponent(JSON.stringify(data,null,2))));const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`,{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify({message,content,branch:'main',...(sha?{sha}: {})})});if(!r.ok)throw new Error(`GitHub PUT ${r.status}`);return r.json()}
function githubHeaders(env){return{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}}
function corsHeaders(request){const origin=request.headers.get('Origin');const allowed=origin&&/^https:\/\/(?:www\.)?redlighte\.ir$/.test(origin)?origin:'https://redlighte.ir';return{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,PUT,OPTIONS',Vary:'Origin'}}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}

async function readSession(request,env){
  const cookie=request.headers.get('Cookie')||'';
  const match=cookie.match(/(?:^|;\s*)redlighte_session=([^;]+)/);
  if(!match)return null;
  try{
    const raw=decodeURIComponent(match[1]);
    const payload=JSON.parse(atob(raw));
    if(!payload?.id||!payload?.username)return null;
    if(payload.exp&&payload.exp<Date.now())return null;
    return payload;
  }catch{return null}
}
