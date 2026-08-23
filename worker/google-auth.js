const DATA_REPO='amirsepehr2020/redlighte-data';
const GOOGLE_AUTH='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN='https://oauth2.googleapis.com/token';
const GOOGLE_JWKS='https://www.googleapis.com/oauth2/v3/certs';
const STATE_COOKIE='redlighte_google_state';
const PENDING_COOKIE='redlighte_google_pending';

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const path=url.pathname;
    const cors=corsHeaders(request);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    try{
      if(path==='/api/auth/google'&&request.method==='GET')return startGoogle(request,env);
      if(path==='/api/auth/google/callback'&&request.method==='GET')return googleCallback(request,env);
      if(path==='/api/auth/google/complete'&&request.method==='POST')return completeGoogle(request,env,cors);
      return json({error:'Not found.'},404,cors);
    }catch(error){
      console.error('GOOGLE_AUTH_ERROR',error);
      return json({error:'Google authentication is temporarily unavailable.'},500,cors);
    }
  }
};

async function startGoogle(request,env){
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)return new Response('Google Login is not configured.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  const url=new URL(request.url);
  const redirectUri=googleRedirectUri(url);
  const state=randomToken(32);
  const nonce=randomToken(32);
  const statePayload=await signPayload({state,nonce,exp:Date.now()+600000},env.GITHUB_TOKEN);
  const googleUrl=new URL(GOOGLE_AUTH);
  googleUrl.searchParams.set('client_id',env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set('redirect_uri',redirectUri);
  googleUrl.searchParams.set('response_type','code');
  googleUrl.searchParams.set('scope','openid email profile');
  googleUrl.searchParams.set('state',state);
  googleUrl.searchParams.set('nonce',nonce);
  googleUrl.searchParams.set('prompt','select_account');
  return new Response(null,{status:302,headers:{Location:googleUrl.toString(),'Set-Cookie':cookie(STATE_COOKIE,statePayload,600),'Cache-Control':'no-store'}});
}

async function googleCallback(request,env){
  const url=new URL(request.url);
  const code=url.searchParams.get('code');
  const returnedState=url.searchParams.get('state');
  if(url.searchParams.get('error'))return redirect(url,'/?google_error=access_denied');
  if(!code||!returnedState)return redirect(url,'/?google_error=invalid_request');
  const stateCookie=readCookie(request,STATE_COOKIE);
  const statePayload=stateCookie?await verifyPayload(stateCookie,env.GITHUB_TOKEN):null;
  if(!statePayload||statePayload.state!==returnedState||statePayload.exp<Date.now())return redirect(url,'/?google_error=state_mismatch');
  const redirectUri=googleRedirectUri(url);
  const tokenResponse=await fetch(GOOGLE_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'}).toString()});
  if(!tokenResponse.ok)return redirect(url,'/?google_error=token_exchange');
  const tokens=await tokenResponse.json();
  if(typeof tokens.id_token!=='string')return redirect(url,'/?google_error=missing_id_token');
  const identity=await verifyGoogleIdToken(tokens.id_token,env.GOOGLE_CLIENT_ID,statePayload.nonce);
  if(!identity||!identity.email_verified)return redirect(url,'/?google_error=unverified_email');
  const mapping=await githubFile(env,`google-accounts/${await hashKey(identity.sub)}.json`);
  const clearState=clearCookie(STATE_COOKIE);
  if(mapping){
    const mapped=JSON.parse(mapping.content);
    const account=await githubFile(env,`users/${mapped.username}/data.json`);
    if(!account)return redirectWithCookies(url,'/?google_error=account_missing',[clearState]);
    const user=JSON.parse(account.content).user;
    const session=await makeSessionCookie(url,env,user);
    return redirectWithCookies(url,'/',[clearState,session]);
  }
  const pending=await signPayload({sub:identity.sub,email:identity.email,name:identity.name||identity.email.split('@')[0],picture:identity.picture||'',emailVerified:true,exp:Date.now()+600000},env.GITHUB_TOKEN);
  return redirectWithCookies(url,'/?google_pending=1',[clearState,cookie(PENDING_COOKIE,pending,600)]);
}

async function completeGoogle(request,env,cors){
  const body=await request.json().catch(()=>({}));
  const mode=body?.mode==='link'?'link':'create';
  const raw=readCookie(request,PENDING_COOKIE);
  const pending=raw?await verifyPayload(raw,env.GITHUB_TOKEN):null;
  if(!pending||pending.exp<Date.now())return json({error:'Google verification has expired. Please try again.'},401,cors);
  const mappingPath=`google-accounts/${await hashKey(pending.sub)}.json`;
  const existingMapping=await githubFile(env,mappingPath);
  if(existingMapping)return json({error:'This Google account is already linked.'},409,cors);
  if(mode==='link'){
    const session=await readSession(request,env);
    if(!session)return json({error:'Log in to your Redlighte account first, then link Google.'},401,cors);
    const path=`users/${session.username}/data.json`;
    const file=await githubFile(env,path);
    if(!file)return json({error:'Account data not found.'},404,cors);
    const data=JSON.parse(file.content);
    data.user.authProviders=data.user.authProviders||{};
    if(data.user.authProviders.google)return json({error:'A Google account is already linked to this Redlighte account.'},409,cors);
    data.user.authProviders.google={sub:pending.sub,email:pending.email,emailVerified:true,linkedAt:new Date().toISOString(),picture:pending.picture||''};
    await githubWrite(env,path,data,file.sha,'Link Google account');
    await githubWrite(env,mappingPath,{username:session.username,userId:session.id,linkedAt:new Date().toISOString()},null,'Create Google account mapping');
    const sessionCookie=await makeSessionCookie(new URL(request.url),env,data.user);
    const headers=new Headers(cors);headers.set('Content-Type','application/json');headers.set('Cache-Control','no-store');headers.append('Set-Cookie',sessionCookie);headers.append('Set-Cookie',clearCookie(PENDING_COOKIE));
    return new Response(JSON.stringify({ok:true,user:{id:data.user.id,name:data.user.name,username:data.user.username}}),{status:200,headers});
  }
  const username=await uniqueUsername(env,pending.name);
  const id=crypto.randomUUID();
  const data={user:{id,name:pending.name,username,authProviders:{google:{sub:pending.sub,email:pending.email,emailVerified:true,linkedAt:new Date().toISOString(),picture:pending.picture||''}}},settings:{theme:'dark',accent:'#ff3045'},chats:[]};
  await githubWrite(env,`users/${username}/data.json`,data,null,'Create Google account');
  await githubWrite(env,mappingPath,{username,userId:id,linkedAt:new Date().toISOString()},null,'Create Google account mapping');
  const sessionCookie=await makeSessionCookie(new URL(request.url),env,data.user);
  const headers=new Headers(cors);headers.set('Content-Type','application/json');headers.set('Cache-Control','no-store');headers.append('Set-Cookie',sessionCookie);headers.append('Set-Cookie',clearCookie(PENDING_COOKIE));
  return new Response(JSON.stringify({ok:true,user:{id,name:pending.name,username}}),{status:201,headers});
}

async function verifyGoogleIdToken(token,clientId,expectedNonce){
  const parts=token.split('.');
  if(parts.length!==3)return null;
  const header=decodeJson(parts[0]);
  const payload=decodeJson(parts[1]);
  if(!header||!payload||header.alg!=='RS256'||!header.kid)return null;
  const keysResponse=await fetch(GOOGLE_JWKS);
  if(!keysResponse.ok)return null;
  const keys=await keysResponse.json();
  const jwk=keys.keys?.find(k=>k.kid===header.kid&&k.alg==='RS256');
  if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,base64urlBytes(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if(!valid)return null;
  const now=Math.floor(Date.now()/1000);
  if(payload.iss!=='https://accounts.google.com'&&payload.iss!=='accounts.google.com')return null;
  if(payload.aud!==clientId||!payload.sub||!payload.email||payload.exp<=now||payload.iat>now+60)return null;
  if(expectedNonce&&payload.nonce!==expectedNonce)return null;
  return {sub:String(payload.sub),email:String(payload.email).toLowerCase(),email_verified:payload.email_verified===true,name:String(payload.name||payload.email),picture:String(payload.picture||'')};
}

async function uniqueUsername(env,name){
  const base=cleanUsername(name)||`google${Math.random().toString(36).slice(2,8)}`;
  let username=base.slice(0,32);
  for(let i=0;i<100;i++){
    if(!(await githubFile(env,`users/${username}/data.json`)))return username;
    const suffix=String(i+2);username=`${base.slice(0,32-suffix.length)}${suffix}`;
  }
  return `google${crypto.randomUUID().replace(/-/g,'').slice(0,20)}`;
}

function cleanUsername(value){return String(value||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'').slice(0,24)}
function googleRedirectUri(url){return `https://${url.hostname}/api/auth/google/callback`}
function randomToken(bytes){const a=crypto.getRandomValues(new Uint8Array(bytes));return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hashKey(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function signPayload(payload,secret){const raw=toBase64(JSON.stringify(payload));const sig=await sign(raw,secret);return `${raw}.${sig}`}
async function verifyPayload(value,secret){try{const dot=value.lastIndexOf('.');if(dot<1)return null;const raw=value.slice(0,dot),sig=value.slice(dot+1);const expected=await sign(raw,secret);if(!timingSafeEqual(sig,expected))return null;return JSON.parse(fromBase64(raw))}catch{return null}}
async function sign(value,secret){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));return hex(new Uint8Array(sig))}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function makeSessionCookie(url,env,user){const payload=toBase64(JSON.stringify({id:user.id,name:user.name,username:user.username,exp:Date.now()+604800000}));const sig=await sign(payload,env.GITHUB_TOKEN);return `redlighte_session=${payload}.${sig}; Path=/; Domain=redlighte.ir; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`}
async function readSession(request,env){const raw=readCookie(request,'redlighte_session');if(!raw)return null;const dot=raw.lastIndexOf('.');if(dot<1)return null;const payload=raw.slice(0,dot),sig=raw.slice(dot+1);try{const expected=await sign(payload,env.GITHUB_TOKEN);if(!timingSafeEqual(sig,expected))return null;const data=JSON.parse(fromBase64(payload));return data?.exp&&data.exp>Date.now()?data:null}catch{return null}}
function cookie(name,value,maxAge){return `${name}=${value}; Path=/; Domain=redlighte.ir; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
function clearCookie(name){return `${name}=; Path=/; Domain=redlighte.ir; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
function readCookie(request,name){const cookies=request.headers.get('Cookie')||'';const match=cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));return match?match[1]:''}
function redirect(url,path){return new Response(null,{status:302,headers:{Location:new URL(path,url.origin).toString(),'Cache-Control':'no-store'}})}
function redirectWithCookies(url,path,cookies){const headers=new Headers();headers.set('Location',new URL(path,url.origin).toString());headers.set('Cache-Control','no-store');cookies.forEach(value=>headers.append('Set-Cookie',value));return new Response(null,{status:302,headers})}
async function githubFile(env,path){const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}?ref=main`,{headers:githubHeaders(env)});if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub GET ${r.status}`);const x=await r.json();const bytes=Uint8Array.from(atob(x.content.replace(/\n/g,'')),c=>c.charCodeAt(0));return{sha:x.sha,content:new TextDecoder().decode(bytes)}}
async function githubWrite(env,path,data,sha,message){const content=toBase64(JSON.stringify(data,null,2));const r=await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`,{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify({message,content,branch:'main',...(sha?{sha}:{})})});if(!r.ok)throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`)}
function githubHeaders(env){return{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Redlighte'}}
function toBase64(text){const bytes=new TextEncoder().encode(text);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function fromBase64(value){const binary=atob(value.replace(/\s/g,''));const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new TextDecoder().decode(bytes)}
function decodeJson(value){try{return JSON.parse(new TextDecoder().decode(base64urlBytes(value)))}catch{return null}}
function base64urlBytes(value){const normalized=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);const binary=atob(normalized);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function hex(bytes){return[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}})}
function corsHeaders(request){const origin=request.headers.get('Origin');const allowed=origin&&/^https:\/\/(?:www\.)?redlighte\.ir$/.test(origin)?origin:'https://redlighte.ir';return{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'}}
