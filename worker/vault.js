const DATA_REPO='amirsepehr2020/redlighte-data';

export async function handleVault(request,env,url){
  const cors=corsHeaders(request);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{
    const session=await readSession(request,env);
    if(!session)return json({error:'Unauthorized.',code:'AUTH_REQUIRED'},401,cors);
    const path=`vault/${session.username}.json`;
    const file=await githubFile(env,path);
    const data=normalize(file);
    if(request.method==='GET')return json({user:{id:session.id,name:session.name,username:session.username},collections:data.collections,items:data.items,trash:data.trash,stats:{items:data.items.length,favorites:data.items.filter(x=>x.favorite).length,collections:data.collections.length,trash:data.trash.length}},200,cors);
    if(request.method==='POST'){
      const body=await request.json().catch(()=>null); const action=clean(body?.action,30)||'create';
      const now=new Date().toISOString();
      if(action==='create'){
        const title=clean(body?.title,120),content=clean(body?.body,20000),type=clean(body?.type,24).toLowerCase()||'note';
        if(!title||!content)return json({error:'Title and content are required.'},400,cors);
        if(!['note','link','code','bookmark','checklist','idea','document'].includes(type))return json({error:'Invalid item type.'},400,cors);
        const item={id:crypto.randomUUID(),title,body:content,type,tags:tags(body?.tags),collectionId:clean(body?.collectionId,80),favorite:!!body?.favorite,createdAt:now,updatedAt:now,checked: type==='checklist'?!!body?.checked:false};
        data.items.unshift(item);data.items=data.items.slice(0,500);await githubWrite(env,path,data,file?.sha||null,'Create Vault item');return json({item},201,cors);
      }
      if(action==='update'){
        const id=clean(body?.id,80),item=data.items.find(x=>x.id===id);if(!item)return json({error:'Item not found.'},404,cors);
        if(body.title!==undefined)item.title=clean(body.title,120);if(body.body!==undefined)item.body=clean(body.body,20000);if(body.type!==undefined)item.type=clean(body.type,24).toLowerCase();if(body.tags!==undefined)item.tags=tags(body.tags);if(body.collectionId!==undefined)item.collectionId=clean(body.collectionId,80);if(body.favorite!==undefined)item.favorite=!!body.favorite;if(body.checked!==undefined)item.checked=!!body.checked;item.updatedAt=now;
        await githubWrite(env,path,data,file?.sha||null,'Update Vault item');return json({item},200,cors);
      }
      if(action==='collection_create'){
        const name=clean(body?.name,60);if(!name)return json({error:'Collection name is required.'},400,cors);if(data.collections.some(x=>x.name.toLowerCase()===name.toLowerCase()))return json({error:'Collection already exists.'},409,cors);const c={id:crypto.randomUUID(),name,createdAt:now};data.collections.push(c);await githubWrite(env,path,data,file?.sha||null,'Create Vault collection');return json({collection:c},201,cors);
      }
      if(action==='collection_delete'){const id=clean(body?.id,80);if(!data.collections.some(x=>x.id===id))return json({error:'Collection not found.'},404,cors);data.collections=data.collections.filter(x=>x.id!==id);data.items.forEach(x=>{if(x.collectionId===id)x.collectionId=''});await githubWrite(env,path,data,file?.sha||null,'Delete Vault collection');return json({ok:true},200,cors)}
      if(action==='restore'){const id=clean(body?.id,80),idx=data.trash.findIndex(x=>x.id===id);if(idx<0)return json({error:'Item not found in trash.'},404,cors);const item=data.trash.splice(idx,1)[0];item.deletedAt=undefined;item.updatedAt=now;data.items.unshift(item);await githubWrite(env,path,data,file?.sha||null,'Restore Vault item');return json({item},200,cors)}
      if(action==='permanent_delete'){const id=clean(body?.id,80);data.trash=data.trash.filter(x=>x.id!==id);await githubWrite(env,path,data,file?.sha||null,'Permanently delete Vault item');return json({ok:true},200,cors)}
      if(action==='empty_trash'){data.trash=[];await githubWrite(env,path,data,file?.sha||null,'Empty Vault trash');return json({ok:true},200,cors)}
      return json({error:'Unknown action.'},400,cors);
    }
    if(request.method==='DELETE'){
      const id=clean(url.searchParams.get('id'),80),idx=data.items.findIndex(x=>x.id===id);if(idx<0)return json({error:'Item not found.'},404,cors);const item=data.items.splice(idx,1)[0];item.deletedAt=new Date().toISOString();data.trash.unshift(item);data.trash=data.trash.slice(0,500);await githubWrite(env,path,data,file?.sha||null,'Move Vault item to trash');return json({ok:true},200,cors);
    }
    return json({error:'Method not allowed.'},405,{...cors,Allow:'GET,POST,DELETE,OPTIONS'});
  }catch(error){console.error('VAULT_API_ERROR',error);return json({error:'Vault service error.'},500,cors)}
}

function normalize(file){let d={version:2,collections:[],items:[],trash:[]};if(file){try{d={...d,...JSON.parse(file.content)}}catch{}}if(!Array.isArray(d.collections))d.collections=[];if(!Array.isArray(d.items))d.items=[];if(!Array.isArray(d.trash))d.trash=[];d.version=2;d.items=d.items.map(x=>({...x,tags:Array.isArray(x.tags)?x.tags:[],collectionId:x.collectionId||'',favorite:!!x.favorite}));return d}
function tags(v){const a=Array.isArray(v)?v:v==null?[]:String(v).split(',');return [...new Set(a.map(x=>String(x).trim().replace(/^#/,'').slice(0,30)).filter(Boolean))].slice(0,12)}
async function readSession(request,env){const cookie=request.headers.get('Cookie')||'',match=cookie.match(/(?:^|;\s*)redlighte_session=([^;]+)/);if(!match)return null;const raw=match[1],dot=raw.lastIndexOf('.');if(dot<1)return null;const payload=raw.slice(0,dot),sig=raw.slice(dot+1);try{const expected=await sign(payload,env.GITHUB_TOKEN);if(!timingSafeEqual(new TextEncoder().encode(sig),new TextEncoder().encode(expected)))return null;const data=JSON.parse(fromBase64(payload));if(!data?.id||!data?.username||!data?.exp||data.exp<Date.now())return null;return data}catch{return null}}
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