const DATA_REPO='amirsepehr2020/redlighte-data';

export async function handleVault(request,env,url){
  const cors=corsHeaders(request);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const me=await fetch(new Request(new URL('/api/auth/me',request.url),request));
  if(!me.ok)return json({error:'Authentication service unavailable.'},503,cors);
  const auth=await me.json().catch(()=>({}));
  if(!auth.authenticated||!auth.user?.username)return json({error:'Unauthorized.',code:'AUTH_REQUIRED'},401,cors);
  const username=auth.user.username;
  const path=`vault/${username}.json`;
  try{
    const file=await githubFile(env,path);
    const data=file?JSON.parse(file.content):{items:[]};
    if(!Array.isArray(data.items))data.items=[];
    if(request.method==='GET')return json({user:auth.user,items:data.items},200,cors);
    if(request.method==='POST'){
      const body=await request.json().catch(()=>null);
      const title=clean(body?.title,120),bodyText=clean(body?.body,20000),type=clean(body?.type,24).toLowerCase()||'note';
      if(!title||!bodyText)return json({error:'Title and content are required.'},400,cors);
      const item={id:crypto.randomUUID(),title,body:bodyText,type,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      data.items.unshift(item);data.items=data.items.slice(0,500);
      await githubWrite(env,path,data,file?.sha||null,'Update Vault');
      return json({item},201,cors);
    }
    if(request.method==='DELETE'){
      const id=clean(url.searchParams.get('id'),80);
      if(!id)return json({error:'Item id is required.'},400,cors);
      const next=data.items.filter(item=>item?.id!==id);
      if(next.length===data.items.length)return json({error:'Item not found.'},404,cors);
      data.items=next;await githubWrite(env,path,data,file.sha,'Update Vault');return json({ok:true},200,cors);
    }
    return json({error:'Method not allowed.'},405,{...cors,Allow:'GET,POST,DELETE,OPTIONS'});
  }catch(error){console.error('VAULT_API_ERROR',error);return json({error:'Vault service error.'},500,cors)}
}

async function githubFile(env,path){const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}?ref=main`,{headers:githubHeaders(env)});if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub GET ${r.status}`);const x=await r.json();const bytes=Uint8Array.from(atob(x.content.replace(/\n/g,'')),c=>c.charCodeAt(0));return{sha:x.sha,content:new TextDecoder().decode(bytes)}}
async function githubWrite(env,path,data,sha,message){const content=toBase64(JSON.stringify(data,null,2));const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`,{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify({message,content,branch:'main',...(sha?{sha}:{})})});if(!r.ok)throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`)}
function githubHeaders(env){return{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Redlighte'}}
function toBase64(text){const bytes=new TextEncoder().encode(text);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function clean(v,max){return typeof v==='string'?v.trim().slice(0,max):''}
function corsHeaders(request){const origin=request.headers.get('Origin');const allowed=origin&&/^https:\/\/(?:www\.)?redlighte\.ir$/.test(origin)?origin:'https://redlighte.ir';return{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Vary':'Origin'}}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}})}
