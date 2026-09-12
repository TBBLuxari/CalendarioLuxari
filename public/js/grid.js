// grid.js — construcción de la cuadrícula, pintado de celdas y marcador de
// "ahora". El horario (data) y las propuestas de invitado viven en el
// backend; este archivo mantiene el caché en memoria y llama a la API.

const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

let data = null;
let sel = 'sleep';
let drag = false;
let dragStart = null;

const tbody = document.getElementById('sbody');
const hrow = document.getElementById('hrow');
const cells = Array.from({length:7}, () => []);
const timeCells = [];

async function fetchSchedule(){
  data = await api('/schedule');
}

function buildGrid(){
  hrow.innerHTML = '';
  const corner = document.createElement('th'); corner.className = 'corner'; hrow.appendChild(corner);
  days.forEach((d, i) => {
    const th = document.createElement('th');
    th.textContent = d;
    th.dataset.day = i;
    hrow.appendChild(th);
  });

  tbody.innerHTML = '';
  for(let d = 0; d < 7; d++) cells[d].length = 0;
  timeCells.length = 0;

  for(let h = 0; h < 24; h++){
    const tr = tbody.insertRow();

    const tc = tr.insertCell();
    tc.className = 'tc' + (h % 6 === 0 ? ' h6' : '');
    tc.dataset.h = h;
    const span = document.createElement('span');
    span.className = 'tlabel';
    span.textContent = h.toString().padStart(2, '0') + ':00';
    tc.appendChild(span);
    timeCells.push(tc);

    for(let d = 0; d < 7; d++){
      const td = tr.insertCell();
      td.className = 'sc' + (h % 6 === 0 ? ' h6' : '');
      td.dataset.d = d; td.dataset.h = h;
      cells[d].push(td);
      applyCell(td, data[d][h]);

      td.addEventListener('mousedown', e => {
        drag = true; dragStart = {d, h};
        paint(d, h); showDragTip(d, h, h);
        e.preventDefault();
      });
      td.addEventListener('mouseenter', () => { if(drag) paintRange(d, h); });
      td.addEventListener('dblclick', () => {
        if(currentRole === 'guest'){ removeOwnProposal(d, h); return; }
        data[d][h] = 'free'; applyCell(td, 'free');
      });
    }
  }
  document.addEventListener('mouseup', endDrag);
  renderProposalOverlay();
}

function paint(d, h){
  if(currentRole === 'guest'){
    if(data[d][h] !== 'free'){ toast('Esa hora ya está ocupada — solo puedes proponer horario en celdas libres'); return; }
    addProposal(d, h, sel);
    return;
  }
  data[d][h] = sel;
  applyCell(cells[d][h], sel);
}

function paintRange(d, h){
  if(!dragStart || dragStart.d !== d) dragStart = {d, h};
  paint(d, h);
  const from = Math.min(dragStart.h, h), to = Math.max(dragStart.h, h);
  showDragTip(d, from, to);
}

function endDrag(){
  drag = false; dragStart = null; hideDragTip();
}

function applyCell(td, id){
  const a = activityMap[id] || activityMap.free;
  td.style.background = a.bg;
  td.style.color = a.fg;
  td.textContent = a.icon ? (a.icon + ' ' + a.label) : (id === 'free' ? '' : a.label);
}

function renderAll(){
  for(let d = 0; d < 7; d++) for(let h = 0; h < 24; h++) applyCell(cells[d][h], data[d][h]);
}

async function resetAll(){
  if(!confirm('¿Descartar los cambios sin guardar y recargar el horario guardado en el servidor?')) return;
  await fetchSchedule();
  renderAll();
  toast('↺ Horario recargado desde el servidor');
}

function clearAll(){
  if(!confirm('¿Vaciar todo el horario? Todas las celdas quedarán en "Libre".')) return;
  data = Array.from({length:7}, () => Array(24).fill('free'));
  renderAll();
}

async function saveData(){
  try{
    await api('/schedule', { method: 'PUT', body: data });
    toast('✓ Guardado');
  }catch(e){
    toast('❌ No se pudo guardar: ' + e.message);
  }
}

/* TOUCH */
let lastTouchTd = null;
function initTouch(){
  const gw = document.getElementById('grid');
  gw.addEventListener('touchstart', e => {
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    if(el?.classList.contains('sc')){
      const d = +el.dataset.d, h = +el.dataset.h;
      drag = true; dragStart = {d, h};
      paint(d, h); showDragTip(d, h, h);
      lastTouchTd = el; e.preventDefault();
    }
  }, {passive:false});
  gw.addEventListener('touchmove', e => {
    if(!drag) return;
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    if(el?.classList.contains('sc') && el !== lastTouchTd){
      paintRange(+el.dataset.d, +el.dataset.h);
      lastTouchTd = el;
    }
    e.preventDefault();
  }, {passive:false});
  document.addEventListener('touchend', () => { endDrag(); lastTouchTd = null; });
}

/* AVISO DE ARRASTRE */
const dragTip = document.getElementById('dragTip');
function showDragTip(d, fromH, toH){
  const start = fromH.toString().padStart(2, '0') + ':00';
  const end = ((toH + 1) % 24).toString().padStart(2, '0') + ':00';
  const hours = toH - fromH + 1;
  dragTip.textContent = `${days[d]} · ${start} – ${end} (${hours} h)`;
  dragTip.classList.add('show');
}
function hideDragTip(){ dragTip.classList.remove('show'); }

/* MARCADOR DE "AHORA" */
function updateNow(){
  document.querySelectorAll('.now-col').forEach(el => el.classList.remove('now-col'));
  document.querySelectorAll('.now-row').forEach(el => el.classList.remove('now-row'));
  document.querySelectorAll('.now-cell').forEach(el => {
    el.classList.remove('now-cell');
    const l = el.querySelector('.now-line');
    if(l) l.remove();
  });

  const now = new Date();
  const d = (now.getDay() + 6) % 7; // getDay(): 0=domingo → nuestro índice: 0=lunes
  const h = now.getHours();
  const m = now.getMinutes();

  const th = hrow.children[d + 1];
  if(th) th.classList.add('now-col');

  const tc = timeCells[h];
  if(tc) tc.classList.add('now-row');

  const td = cells[d]?.[h];
  if(td){
    td.classList.add('now-cell');
    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = (m / 60 * 100) + '%';
    td.appendChild(line);
  }
}

/* PROPUESTAS DE INVITADOS
   Un invitado solo puede "proponer" actividades sobre celdas libres — no
   modifica el horario directamente. El propietario aprueba o rechaza desde
   el panel 📩 Propuestas. Todo vive ahora en el backend (tabla proposals). */
let proposals = [];

async function fetchProposals(){
  proposals = await api('/proposals');
  renderProposalOverlay();
  updateProposalBadges();
}

async function addProposal(d, h, actId){
  try{
    const p = await api('/proposals', { method: 'POST', body: { d, h, actId } });
    proposals = proposals.filter(x => !(x.d === d && x.h === h));
    proposals.push(p);
    renderProposalOverlay();
    updateProposalBadges();
  }catch(e){
    toast('❌ ' + e.message);
  }
}

async function removeProposal(id){
  await api('/proposals/' + id, { method: 'DELETE' });
  proposals = proposals.filter(p => p.id !== id);
  renderProposalOverlay();
  updateProposalBadges();
}

function removeOwnProposal(d, h){
  const p = proposals.find(x => x.d === d && x.h === h);
  if(p) removeProposal(p.id);
}

function applyProposalCell(td, actId){
  const a = activityMap[actId] || activityMap.free;
  td.style.background = a.bg;
  td.style.color = a.fg;
  td.textContent = (a.icon ? a.icon + ' ' : '') + a.label;
  td.classList.add('proposal-cell');
}

function renderProposalOverlay(){
  if(!data) return;
  document.querySelectorAll('td.proposal-cell').forEach(td => {
    td.classList.remove('proposal-cell');
    const d = +td.dataset.d, h = +td.dataset.h;
    applyCell(td, data[d][h]);
  });
  proposals.forEach(p => {
    const td = cells[p.d]?.[p.h];
    if(td && data[p.d][p.h] === 'free') applyProposalCell(td, p.actId);
  });
}

async function approveProposal(p){
  await api('/proposals/' + p.id + '/approve', { method: 'POST' });
  await fetchSchedule();
  proposals = proposals.filter(x => x.id !== p.id);
  renderAll();
  updateProposalBadges();
}

function updateProposalBadges(){
  const propBtn = document.getElementById('propBtn');
  if(propBtn) propBtn.textContent = `📩 Propuestas (${proposals.length})`;
}

function openPropModal(){
  renderPropList();
  document.getElementById('propModal').classList.add('show');
}
function closePropModal(){
  document.getElementById('propModal').classList.remove('show');
}
function renderPropList(){
  const list = document.getElementById('propList');
  list.innerHTML = '';
  if(proposals.length === 0){
    list.innerHTML = '<div class="act-empty">No hay propuestas pendientes.</div>';
    return;
  }
  proposals.forEach(p => {
    const a = activityMap[p.actId] || activityMap.free;
    const row = document.createElement('div');
    row.className = 'act-row';
    const label = document.createElement('span');
    label.style.cssText = 'flex:1;font-size:12px;';
    label.textContent = `${days[p.d]} ${String(p.h).padStart(2, '0')}:00–${String(p.h + 1).padStart(2, '0')}:00 → ${(a.icon ? a.icon + ' ' : '') + a.label}`;
    const ok = document.createElement('button');
    ok.className = 'btn'; ok.textContent = '✓ Aprobar';
    ok.onclick = async () => { await approveProposal(p); renderPropList(); };
    const no = document.createElement('button');
    no.className = 'btn'; no.textContent = '✕ Rechazar';
    no.onclick = async () => { await removeProposal(p.id); renderPropList(); };
    row.append(label, ok, no);
    list.appendChild(row);
  });
}

async function copyProposalsText(){
  if(proposals.length === 0){ toast('No tienes propuestas pendientes'); return; }
  const lines = proposals.map(p => {
    const a = activityMap[p.actId] || activityMap.free;
    return `${days[p.d]} ${String(p.h).padStart(2, '0')}:00–${String(p.h + 1).padStart(2, '0')}:00 → ${(a.icon ? a.icon + ' ' : '') + a.label}`;
  });
  const text = 'Propuestas de horario:\n' + lines.join('\n');
  try{
    await navigator.clipboard.writeText(text);
    toast('📋 Copiado — envíaselo al propietario');
  }catch(e){
    toast('No se pudo copiar automáticamente');
  }
}
