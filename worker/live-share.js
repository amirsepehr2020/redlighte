import core from './index-core.js';
export async function handleLiveShare(request,env,url){
 const auth=await authenticate(request,env);if(!auth)return new Response(JSON.stringify({error:'Unauthorized.'}),{status:401,headers:{'Content-Type':'application/json'}});
 const m=url.pathname.match(/^\/api\/room-live\/([^/]+)\/ws$/);if(!m||request.headers.get('Upgrade')!=='websocket')return new Response(JSON.stringify({error:'WebSocket upgrade required.'}),{status:426,headers:{'Content-Type':'application/json'}});
 let roomId;try{roomId=decodeURIComponent(m[1])}catch{return new Response(JSON.stringify({error:'Invalid room.'}),{status:400,headers:{'Content-Type':'application/json'}})}
 const check=await env.ROOMS.get(env.ROOMS.idFromName(roomId)).fetch('https://room/info');
 if(!check.ok)return new Response(JSON.stringify({error:'Join the room first.'}),{status:403,headers:{'Content-Type':'application/json'}});
 let room;try{room=await check.json()}catch{return new Response(JSON.stringify({error:'Room unavailable.'}),{status:503,headers:{'Content-Type':'application/json'}})}
 if(!room?.room?.members?.some(x=>x.username===auth.user.username))return new Response(JSON.stringify({error:'Join the room first.'}),{status:403,headers:{'Content-Type':'application/json'}});
 return env.LIVE_SHARE.get(env.LIVE_SHARE.idFromName(roomId)).fetch(new Request('https://live-share/ws',{headers:{Upgrade:'websocket','X-Live-User':JSON.stringify(auth.user)}}));
}
async function authenticate(request,env){try{const h=new Headers(),c=request.headers.get('Cookie');if(c)h.set('Cookie',c);const r=await core.fetch(new Request(new URL('/api/auth/me',request.url),{headers:h}),env,{}),b=await r.json();return r.ok&&b?.authenticated?{user:b.user}:null}catch{return null}}
export class LiveShareDurableObject{
 constructor(state){this.state=state;this.s=new Map()}
 async fetch(req){const u=new URL(req.url);if(u.pathname!=='/ws'||req.headers.get('Upgrade')!=='websocket')return new Response('Not found',{status:404});let user;try{user=JSON.parse(req.headers.get('X-Live-User'))}catch{return new Response('Bad user',{status:400})}const pair=new WebSocketPair(),[client,server]=Object.values(pair);const old=this.s.get(user.username);if(old)try{old.close(1000,'Replaced')}catch{}server.accept();this.s.set(user.username,server);server.addEventListener('close',()=>{if(this.s.get(user.username)===server)this.s.delete(user.username)});server.addEventListener('error',()=>{if(this.s.get(user.username)===server)this.s.delete(user.username)});server.addEventListener('message',e=>this.message(user,String(e.data)));server.send(JSON.stringify({type:'LIVE_SIGNAL_READY',user:user.username}));return new Response(null,{status:101,webSocket:client})}
 message(user,raw){let m;try{m=JSON.parse(raw)}catch{return}const allowed=['READY','OFFER','ANSWER','ICE','SHARE_START','SHARE_STOP'];if(!allowed.includes(m.type))return;if(m.type==='READY')return this.route(m.host,{type:'VIEWER_READY',from:user.username});if(m.type==='SHARE_START'||m.type==='SHARE_STOP'){return this.broadcast({type:m.type,from:user.username},user.username)}if(!m.to||!this.s.has(m.to))return;this.send(m.to,{...m,from:user.username})}
 route(to,m){if(to)this.send(to,m)}
 send(to,m){const w=this.s.get(to);if(!w)return;try{w.send(JSON.stringify(m))}catch{if(this.s.get(to)===w)this.s.delete(to)}}
 broadcast(m,except){const x=JSON.stringify(m);for(const [u,w]of this.s)if(u!==except)try{w.send(x)}catch{if(this.s.get(u)===w)this.s.delete(u)}}
}
