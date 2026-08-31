const DATA_REPO='amirsepehr2020/redlighte-data';

export async function handleVault(request,env,url){
  const cors=corsHeaders(request);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{
    const session=await readSession(request,env);
    if(!session)return json({error:'Unauthorized.',code:'AUTH_REQUIRED'},401,cors);
    const username=session.username;
    const path=`vault/${username}.json`;
    const file=await githubFile(env,path);
    const data=file?JSON.parse(file.content):{items:[]};
    if(!Array.isArray(data.items))data.items=[];
    if(request.method==='GET')return json({user:{id:session.id,name:session.name,username:session.username},items:data.items},200,cors);
    if(request.method==='POST'){
      const body=await request.json().catch(()=>null);
      const title=clean(body?.title,120),bodyText=clean(body?.body,20000),type=clean(body?.type,24).toLowerCase()||'note';
      if(!title||!bodyText)return json({error:'Title and content are required.'},400,cors);
      if(!['note','link','code'].includes(type))return json({error:'Invalid item type.'},400,cors);
      const now=new Date().toISOString();
      const item={id:crypto.randomUUID(),title,body:bodyText,type,createdAt:now,updatedAt:now};
      data.items.unshift(item);data.items=data.items.slice(0,500);
      await githubWrite(env,path,data,file?.sha||null,'Update Vault');
      return json({item},201,cors);
    }
    if(request.method==='DELETE'){
      const id=clean(url.searchParams.get('id'),80);
      if(!id)return json({error:'Item id is required.'},400,cors);
      const next=data.items.filter(item=>item?.id!==id);
      if(next.length===data.items.length)return json({error:'Item not found.'},404,cors);
      data.items=next;
      await githubWrite(env,path,data,file.sha,'Update Vault');
      return json({ok:true},200,cors);
    }
    return json({error:'Method not allowed.'},405,{...cors,Allow:'GET,POST,DELETE,OPTIONS'});
  }catch(error){
    console.error('VAULT_API_ERROR',error);
    return json({error:'Vault service error.'},500,cors);
  }
}

async function readSession(request,env){
  const cookie=request.headers.get('Cookie')||'';
  const match=cookie.match(/(?:^|;\s*)redlighte_session=([^;]+)/);
  if(!match)return null;
  const raw=match[1];
  const dot=raw.lastIndexOf('.');
  if(dot<1)return null;
  const payload=raw.slice(0,dot),sig=raw.slice(dot+1);
  try{
    const expected=await sign(payload,env.GITHUB_TOKEN);
    if(!timingSafeEqual(new TextEncoder().encode(sig),new TextEncoder().encode(expected)))return null;
    const data=JSON.parse(fromBase64(payload));
    if(!data?.id||!data?.username||!data?.exp||data.exp<Date.now())return null;
    return data;
  }catch{return null}
}
async function sign(value,secret){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));return hex(new Uint8Array(sig))}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a[i]^b[i];return x===0}
function fromBase64(value){const binary=atob(value.replace(/\s/g,''));const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new TextDecoder().decode(bytes)}
function hex(bytes){return[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function githubFile(env,path){const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}?ref=main`,{headers:githubHeaders(env)});if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub GET ${r.status}`);const x=await r.json();const bytes=Uint8Array.from(atob(x.content.replace(/\n/g,'')),c=>c.charCodeAt(0));return{sha:x.sha,content:new TextDecoder().decode(bytes)}}
async function githubWrite(env,path,data,sha,message){const content=toBase64(JSON.stringify(data,null,2));const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`,{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify({message,content,branch:'main',...(sha?{sha}:{})})});if(!r.ok)throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`)}
function githubHeaders(env){return{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Redlighte'}}
function toBase64(text){const bytes=new TextEncoder().encode(text);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function clean(v,max){return typeof v==='string'?v.trim().slice(0,max):''}
function corsHeaders(request){const origin=request.headers.get('Origin');const allowed=origin&&/^https:\/\/(?:www\.)?redlighte\.ir$/.test(origin)?origin:'https://redlighte.ir';return{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Vary':'Origin'}}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}})}