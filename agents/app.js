const KEY='redlighte_agents_v1';
const $=s=>document.querySelector(s);
let agents=JSON.parse(localStorage.getItem(KEY)||'[]');
let selected=null;
const defaults={name:'',icon:'✦',description:'',instructions:'',caps:['memory']};
function persist(){localStorage.setItem(KEY,JSON.stringify(agents));}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2200)}
function renderList(){const list=$('#agentList');list.innerHTML='';$('#emptyState').style.display=agents.length?'none':'block';agents.forEach(a=>{const b=document.createElement('button');b.className='agent-item'+(a.id===selected?' selected':'');b.innerHTML=`<span class="agent-avatar">${a.icon}</span><span><strong>${esc(a.name||'Unnamed agent')}</strong><small>${esc(a.description||'Custom Redlighte agent')}</small></span>`;b.onclick=()=>openAgent(a.id);list.appendChild(b)})}
function esc(v){const d=document.createElement('div');d.textContent=v;return d.innerHTML}
function newAgent(){const a={id:crypto.randomUUID(),...defaults,name:'New Agent',description:'A custom Redlighte AI agent.',instructions:'You are a helpful Redlighte agent. Stay focused on the user’s goal, be clear and useful, and follow the instructions defined for this agent.',caps:['memory']};agents.push(a);persist();openAgent(a.id);toast('Agent created');}
function openAgent(id){selected=id;const a=agents.find(x=>x.id===id);if(!a)return;$('#editorEmpty').hidden=true;$('#editorContent').hidden=false;$('#editorTitle').textContent=a.name||'Agent';$('#agentName').value=a.name;$('#agentIcon').value=a.icon;$('#agentDescription').value=a.description;$('#agentInstructions').value=a.instructions;document.querySelectorAll('.cap').forEach(c=>c.classList.toggle('active',a.caps.includes(c.dataset.cap)));updatePreview();renderList()}
function updatePreview(){$('#previewIcon').textContent=$('#agentIcon').value;$('#previewName').textContent=$('#agentName').value||'Your agent';$('#previewDescription').textContent=$('#agentDescription').value||'A custom Redlighte AI agent.';$('#editorTitle').textContent=$('#agentName').value||'New agent'}
function save(){if(!selected)return;const a=agents.find(x=>x.id===selected);a.name=$('#agentName').value.trim()||'Unnamed Agent';a.icon=$('#agentIcon').value;a.description=$('#agentDescription').value.trim();a.instructions=$('#agentInstructions').value.trim();a.caps=[...document.querySelectorAll('.cap.active')].map(x=>x.dataset.cap);persist();renderList();toast('Agent saved ✓')}
function deleteAgent(){if(!selected)return;agents=agents.filter(a=>a.id!==selected);selected=null;persist();renderList();$('#editorContent').hidden=true;$('#editorEmpty').hidden=false;toast('Agent deleted')}
function openChat(){if(!selected)return;const a=agents.find(x=>x.id===selected);const params=new URLSearchParams({agent:a.id,name:a.name});window.location.href=`/agents/chat.html?${params}`}
$('#createTop').onclick=$('#createHero').onclick=$('#createSide').onclick=$('#emptyCreate').onclick=newAgent;
$('#saveAgent').onclick=save;$('#deleteAgent').onclick=deleteAgent;$('#openChat').onclick=openChat;$('#homeBtn').onclick=()=>location.href='/';$('#learnBtn').onclick=()=>$('#howModal').hidden=false;$('#closeHow').onclick=()=>$('#howModal').hidden=true;$('#modalCreate').onclick=()=>{ $('#howModal').hidden=true;newAgent()};
$('#agentName').oninput=updatePreview;$('#agentIcon').onchange=updatePreview;$('#agentDescription').oninput=updatePreview;
document.querySelectorAll('.cap').forEach(c=>c.onclick=()=>c.classList.toggle('active'));
$('#themeBtn').onclick=()=>{document.body.classList.toggle('light');toast('Theme preview toggled')};
renderList();
