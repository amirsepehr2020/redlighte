(()=>{
  const $=s=>document.querySelector(s);
  const run=()=>{
    const createBtn=$('#create');
    if(createBtn){
      createBtn.onclick=async()=>{
        const input=$('#roomName'),name=input?.value.trim();
        if(!name){showToast('Enter a room name first');input?.focus();return}
        try{
          const x=await api('/api/room/create',{method:'POST',body:JSON.stringify({name})});
          await api(`/api/room/${encodeURIComponent(x.room.name)}/join`,{method:'POST',body:'{}'});
          input.value='';
          await loadMyRooms();
          setRoom(x.room.name);
          showToast('Room created 🔴');
        }catch(e){showToast(e.message||'Could not create room')}
      };
    }
    const joinBtn=$('#join');
    if(joinBtn)joinBtn.onclick=joinCode;
    let lastLiveSocket=null,lastReadyRoom=null;
    setInterval(()=>{
      if(typeof isHost!=='function' || isHost() || !currentRoom || !liveWs)return;
      if(liveWs.readyState===WebSocket.OPEN && (liveWs!==lastLiveSocket || lastReadyRoom!==roomId)){
        lastLiveSocket=liveWs;lastReadyRoom=roomId;
        liveWs.send(JSON.stringify({type:'READY',host:currentRoom.owner.username}));
      }
    },250);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
