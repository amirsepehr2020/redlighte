const DATA_REPO='amirsepehr2020/redlighte-data';
const MAX_COMMENT_LENGTH=1000;

export async function handleArticleEngagement(request,env,url){
  const cors=corsHeaders(request);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const slug=cleanSlug(url.searchParams.get('slug')||'');
  if(!slug)return json({error:'Article slug is required.'},400,cors);
  try{
    const path=`articles/${slug}.json`;
    const file=await githubFile(env,path);
    const data=file?JSON.parse(file.content):{likes:[],comments:[]};
    data.likes=Array.isArray(data.likes)?data.likes:[];
    data.comments=Array.isArray(data.comments)?data.comments:[];
    if(request.method==='GET'){
      const session=await readSession(request,env);
      const liked=!!session&&data.likes.includes(session.username);
      return json({likes:data.likes.length,liked,comments:data.comments.slice(-100)},200,cors);
    }
    if(request.method!=='POST')return json({error:'Method not allowed.'},405,{...cors,Allow:'GET,POST,OPTIONS'});
    const session=await readSession(request,env);
    if(!session)return json({error:'Unauthorized.'},401,cors);
    const body=await request.json().catch(()=>({}));
    const action=body?.action;
    if(action==='like'||action==='unlike'){
      const username=session.username;
      if(action==='like'&&!data.likes.includes(username))data.likes.push(username);
      if(action==='unlike')data.likes=data.likes.filter(x=>x!==username);
      await githubWrite(env,path,data,file?.sha||null,action==='like'?'Like article':'Unlike article');
      return json({ok:true,likes:data.likes.length,liked:data.likes.includes(username)},200,cors);
    }
    if(action==='comment'){
      const text=typeof body?.text==='string'?body.text.trim():'';
      if(!text)return json({error:'Comment is required.'},400,cors);
      if(text.length>MAX_COMMENT_LENGTH)return json({error:'Comment is too long.'},413,cors);
      data.comments.push({id:crypto.randomUUID(),userId:session.id,username:session.username,name:session.name,text,createdAt:new Date().toISOString()});
      data.comments=data.comments.slice(-100);
      await githubWrite(env,path,data,file?.sha||null,'Add article comment');
      return json({ok:true,comments:data.comments},201,cors);
    }
    return json({error:'Unknown action.'},400,cors);
  }catch(error){console.error('ARTICLE_ENGAGEMENT_ERROR',error);return json({error:'Article engagement service is temporarily unavailable.'},500,cors)}
}

async function readSession(request,env){
  const raw=readCookie(request,'redlighte_session');
  if(!raw)return null;
  const dot=raw.lastIndexOf('.');
  if(dot<1)return null;
  const payload=raw.slice(0,dot),sig=raw.slice(dot+1);
  try{
    const expected=await sign(payload,env.GITHUB_TOKEN);
    if(!timingSafeEqual(sig,expected))return null;
    const data=JSON.parse(fromBase64(payload));
    return data?.exp&&data.exp>Date.now()?data:null;
  }catch{return null}
}
async function sign(value,secret){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));return hex(new Uint8Array(sig))}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function readCookie(request,name){const cookies=request.headers.get('Cookie')||'';const match=cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));return match?match[1]:''}
function fromBase64(value){const binary=atob(value.replace(/\\s/g,''));const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new TextDecoder().decode(bytes)}
function hex(bytes){return[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
function cleanSlug(value){return String(value||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,120)}
async function githubFile(env,path){const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}?ref=main`,{headers:githubHeaders(env)});if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub GET ${r.status}`);const x=await r.json();const bytes=Uint8Array.from(atob(x.content.replace(/\n/g,'')),c=>c.charCodeAt(0));return{sha:x.sha,content:new TextDecoder().decode(bytes)}}
async function githubWrite(env,path,data,sha,message){const content=toBase64(JSON.stringify(data,null,2));const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`,{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify({message,content,branch:'main',...(sha?{sha}:{})})});if(!r.ok)throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`)}
function githubHeaders(env){return{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Redlighte'}}
function toBase64(text){const bytes=new TextEncoder().encode(text);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}})}
function corsHeaders(request){const origin=request.headers.get('Origin');const allowed=origin&&/^https:\/\/(?:www\.)?redlighte\.ir$/.test(origin)?origin:'https://redlighte.ir';return{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'}}