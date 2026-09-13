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

// Lunes de la semana actual, para mostrar "Lunes 15", "Martes 16"… en el
// encabezado (igual que la vista semanal de Google Calendar) — el horario en
// sí sigue siendo la misma plantilla recurrente, esto es solo la etiqueta.
function mondayOfCurrentWeek(){
  const now = new Date();
  const idx = (now.getDay() + 6) % 7; // 0=lunes … 6=domingo
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - idx);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function updateHeaderDates(){
  const monday = mondayOfCurrentWeek();
  for(let i = 0; i < 7; i++){
    const th = hrow.children[i + 1];
    const dateSpan = th?.querySelector('.day-date');
    if(!dateSpan) continue;
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    dateSpan.textContent = d.getDate();
  }
  updateMonthLabel(monday);
}

// Si la semana visible cruza de mes (p. ej. lunes 29 a domingo 5), se
// muestran los dos: "Septiembre / Octubre 2026".
function updateMonthLabel(monday){
  const label = document.getElementById('monthLabel');
  if(!label) return;
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmt = m => m.toLocaleDateString('es-ES', { month: 'long' }).replace(/^./, c => c.toUpperCase());
  const text = monday.getMonth() === sunday.getMonth()
    ? `${fmt(monday)} ${monday.getFullYear()}`
    : `${fmt(monday)} / ${fmt(sunday)} ${sunday.getFullYear()}`;
  label.textContent = text;
}

function buildGrid(){
  hrow.innerHTML = '';
  const corner = document.createElement('th'); corner.className = 'corner'; hrow.appendChild(corner);
  days.forEach((d, i) => {
    const th = document.createElement('th');
    th.dataset.day = i;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'day-name';
    nameSpan.textContent = d;
    const dateSpan = document.createElement('span');
    dateSpan.className = 'day-date';
    th.append(nameSpan, dateSpan);
    hrow.appendChild(th);
  });
  updateHeaderDates();

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
        if(!canPaintNow()) return;
        drag = true; dragStart = {d, h};
        paint(d, h); showDragTip(d, h, h);
        e.preventDefault();
      });
      // El invitado y el rol "booking" tocan de a una celda (sin arrastrar):
      // así no hay parpadeo de "marcar/desmarcar" al pasar el dedo/mouse dos
      // veces por la misma celda mientras arrastra (ver toggleDraft).
      td.addEventListener('mouseenter', () => { if(drag && currentRole === 'owner') paintRange(d, h); });
      td.addEventListener('dblclick', () => {
        if(currentRole !== 'owner') return; // invitado: destoca con un toque (toggleDraft); booking: no edita el horario real
        data[d][h] = 'free'; applyCell(td, 'free');
      });
    }
  }
  document.addEventListener('mouseup', endDrag);
  renderOverlays();
}

function paint(d, h){
  if(currentRole === 'guest'){
    if(!guestPaintMode) return; // toque/clic accidental (ej. mientras navega) sin "Modo proponer" activo
    if(!sel){ toast('Primero crea una actividad arriba (▾) para saber qué proponer'); return; }
    if(h < guestRules.startHour || h >= guestRules.endHour){
      toast(`El propietario solo permite proponer entre las ${String(guestRules.startHour).padStart(2,'0')}:00 y las ${String(guestRules.endHour).padStart(2,'0')}:00`);
      return;
    }
    if(data[d][h] !== 'free'){ toast('Esa hora ya está ocupada — solo puedes proponer horario en celdas libres'); return; }
    toggleDraft(d, h);
    return;
  }
  if(currentRole === 'booking'){
    if(!bookingPickMode) return; // toque/clic accidental (ej. mientras navega) sin "Modo agendar" activo
    if(data[d][h] !== 'free'){ toast('Esa hora ya la tengo ocupada — elige otra'); return; }
    const found = findNextFreeOccurrence(d, h);
    if(!found){ toast('No encontré una fecha libre próxima para ese horario — prueba otra casilla'); return; }
    openBookingModal(d, h, found.date, found.range);
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

/* TOUCH
   Con "Modo proponer"/"Modo agendar" apagado (por defecto) el invitado y el
   rol "booking" NUNCA interceptan el toque acá: el navegador hace scroll/zoom
   normal. Prendido, cada toque marca UNA celda (sin arrastrar) — ver
   canPaintNow()/toggleDraft()/paint(). El propietario conserva el arrastre
   completo de siempre. */
let lastTouchTd = null;
function initTouch(){
  const gw = document.getElementById('grid');
  gw.addEventListener('touchstart', e => {
    if(!canPaintNow()) return;
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    if(el?.classList.contains('sc')){
      const d = +el.dataset.d, h = +el.dataset.h;
      drag = true; dragStart = {d, h};
      paint(d, h); showDragTip(d, h, h);
      lastTouchTd = el; e.preventDefault();
    }
  }, {passive:false});
  gw.addEventListener('touchmove', e => {
    if(!drag || currentRole !== 'owner') return;
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
  updateHeaderDates(); // por si la app queda abierta y cruza la medianoche
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

/* MODO PROPONER + BORRADOR (invitado)
   Por defecto el invitado NO pinta al tocar la cuadrícula: puede navegar,
   hacer scroll o zoom con total libertad (ver initTouch). Solo cuando activa
   "Modo proponer" cada toque/clic marca una celda como borrador LOCAL (nada
   se manda al servidor todavía); puede tocarla de nuevo para destocarla —
   así "reubicar" una propuesta es tan simple como destocar y tocar otra
   celda — y cuando está conforme, "✓ Enviar propuestas" las manda todas de
   una vez. */
let guestPaintMode = false;
let draftProposals = []; // {d, h, actId} — locales, no enviados aún
let guestName = localStorage.getItem('hs_guest_name') || '';

// Puede "tocar" la cuadrícula ahora mismo: el propietario siempre; el
// invitado y el rol "booking" solo con su modo (proponer/agendar) activado —
// si no, un toque para hacer scroll/zoom no debe disparar nada (ver initTouch).
function canPaintNow(){
  if(currentRole === 'guest') return guestPaintMode;
  if(currentRole === 'booking') return bookingPickMode;
  return true;
}

function toggleGuestPaintMode(){
  guestPaintMode = !guestPaintMode;
  const btn = document.getElementById('guestPaintBtn');
  if(btn){
    btn.textContent = guestPaintMode ? '🖌️ Modo proponer: ON' : '🖌️ Modo proponer: OFF';
    btn.classList.toggle('on', guestPaintMode);
  }
  toast(guestPaintMode ? 'Toca celdas libres para marcarlas' : 'Puedes desplazarte libremente sin proponer');
}

function setGuestName(name){
  guestName = name.trim();
  localStorage.setItem('hs_guest_name', guestName);
}

function toggleDraft(d, h){
  const idx = draftProposals.findIndex(p => p.d === d && p.h === h);
  if(idx >= 0) draftProposals.splice(idx, 1);
  else draftProposals.push({ d, h, actId: sel });
  renderDraftCell(d, h);
  updateDraftBar();
}

function renderDraftCell(d, h){
  const td = cells[d]?.[h];
  if(!td) return;
  const draft = draftProposals.find(p => p.d === d && p.h === h);
  td.classList.remove('draft-cell');
  if(draft){
    const a = activityMap[draft.actId] || activityMap.free;
    td.style.background = a.bg;
    td.style.color = a.fg;
    td.textContent = (a.icon ? a.icon + ' ' : '') + a.label;
    td.classList.add('draft-cell');
    return;
  }
  applyCell(td, data[d][h]);
  const existing = proposals.find(p => p.d === d && p.h === h);
  if(existing && data[d][h] === 'free') applyProposalCell(td, existing.actId);
}

function updateDraftBar(){
  const bar = document.getElementById('draftBar');
  if(!bar) return;
  if(draftProposals.length === 0){ bar.classList.remove('show'); return; }
  document.getElementById('draftCount').textContent = `${draftProposals.length} celda(s) marcada(s)`;
  bar.classList.add('show');
}

function discardDraft(){
  const items = [...draftProposals];
  draftProposals = [];
  items.forEach(p => renderDraftCell(p.d, p.h));
  updateDraftBar();
}

async function submitDraft(){
  if(draftProposals.length === 0) return;
  if(!guestName){
    toast('Escribe tu nombre arriba antes de enviar, para que sepan quién propone');
    document.getElementById('guestNameInput')?.focus();
    return;
  }
  const items = [...draftProposals];
  draftProposals = [];
  let okCount = 0;
  const failed = [];
  for(const item of items){
    const sent = await addProposal(item.d, item.h, item.actId);
    if(sent) okCount++;
    else failed.push(item); // falló (ej. ya no está libre, o tope de horas): queda para reintentar
  }
  draftProposals = failed;
  failed.forEach(item => renderDraftCell(item.d, item.h));
  updateDraftBar();
  if(okCount === 0) return;
  toast(`✓ ${okCount} propuesta(s) enviada(s) — gracias, ${guestName}`);
  // La sesión de invitado se cierra sola tras enviar: así el enlace/contraseña
  // compartida queda lista para que la siguiente persona empiece de cero, sin
  // arrastrar el nombre ni ver lo que ya se propuso (ver server/src/routes/proposals.routes.js).
  // Si algo quedó pendiente de reintentar, no cerramos sesión todavía.
  if(failed.length === 0) setTimeout(() => logout(), 1800);
}

/* PROPUESTAS DE INVITADOS
   Un invitado solo puede "proponer" actividades sobre celdas libres — no
   modifica el horario directamente. El propietario aprueba o rechaza desde
   el panel 📩 Propuestas. Todo vive ahora en el backend (tabla proposals). */
let proposals = [];
let guestRules = { startHour: 0, endHour: 24, maxHours: null };

async function fetchProposals(){
  proposals = await api('/proposals');
  renderOverlays();
  updateProposalBadges();
}

async function fetchGuestRules(){
  guestRules = await api('/proposals/rules');
}

async function saveGuestRules(startHour, endHour, maxHours){
  guestRules = await api('/proposals/rules', { method: 'PUT', body: { startHour, endHour, maxHours } });
  toast('✓ Reglas de invitado guardadas');
}

async function addProposal(d, h, actId){
  try{
    const p = await api('/proposals', { method: 'POST', body: { d, h, actId, proposedBy: guestName } });
    proposals = proposals.filter(x => !(x.d === d && x.h === h));
    proposals.push(p);
    renderOverlays();
    updateProposalBadges();
    return true;
  }catch(e){
    toast('❌ ' + e.message);
    return false;
  }
}

async function removeProposal(id){
  await api('/proposals/' + id, { method: 'DELETE' });
  proposals = proposals.filter(p => p.id !== id);
  renderOverlays();
  updateProposalBadges();
}

function applyProposalCell(td, actId){
  const a = activityMap[actId] || activityMap.free;
  td.style.background = a.bg;
  td.style.color = a.fg;
  td.textContent = (a.icon ? a.icon + ' ' : '') + a.label;
  td.classList.add('proposal-cell');
}

// Repinta, en orden, las tres capas que pueden cubrir una celda: el horario
// real (base), las propuestas de invitado pendientes (solo sobre "Libre"), y
// por último los eventos con fecha real que caigan en la semana que se está
// mostrando — un evento gana siempre, porque es lo más específico para ese
// día en concreto (ver mondayOfCurrentWeek/updateHeaderDates). Así, en cuanto
// apruebas algo (propuesta o cita), se ve reflejado aquí mismo, en tu
// calendario de siempre — no en una lista aparte que hay que ir a revisar.
function renderOverlays(){
  if(!data) return;
  document.querySelectorAll('td.sc.proposal-cell, td.sc.event-cell').forEach(td => {
    td.classList.remove('proposal-cell', 'event-cell', 'event-booking', 'event-manual');
    td.removeAttribute('title');
    const d = +td.dataset.d, h = +td.dataset.h;
    applyCell(td, data[d][h]);
  });

  proposals.forEach(p => {
    const td = cells[p.d]?.[p.h];
    if(td && data[p.d][p.h] === 'free') applyProposalCell(td, p.actId);
  });

  if(currentRole === 'owner' && typeof events !== 'undefined' && events.length){
    const monday = mondayOfCurrentWeek();
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(monday); dd.setDate(monday.getDate() + i);
      return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
    });
    events.forEach(ev => {
      const dayIdx = weekDates.indexOf(ev.date);
      if(dayIdx === -1) return; // esta semana no incluye la fecha del evento
      const isBooking = ev.source === 'booking';
      for(let h = ev.startHour; h < ev.endHour; h++){
        const td = cells[dayIdx]?.[h];
        if(!td) continue;
        td.classList.add('event-cell', isBooking ? 'event-booking' : 'event-manual');
        // Estilo en línea (no solo clase): así gana sobre el color de fondo
        // que applyCell ya le puso un momento antes para la actividad base.
        td.style.background = isBooking ? '#ffd7e6' : '#ffe9a8';
        td.style.color = isBooking ? '#7a1f3d' : '#5c4a00';
        td.textContent = (isBooking ? '❤️ ' : '📌 ') + ev.title;
        if(ev.notes) td.title = ev.notes;
      }
    });
  }
}

async function approveProposal(p){
  try{
    await api('/proposals/' + p.id + '/approve', { method: 'POST' });
  }catch(e){
    toast('❌ ' + e.message); // ej. otra propuesta ya ocupó esa hora — sigue pendiente para que la rechaces
    return false;
  }
  await fetchSchedule();
  proposals = proposals.filter(x => x.id !== p.id);
  renderAll();
  updateProposalBadges();
  return true;
}

// Compartida por "Aprobar todas" (todo el mundo) y "✓ Todas" por grupo (una
// sola persona): aprueba en orden y sigue aunque alguna choque de horario con
// otra ya aprobada en la misma tanda (ver approveProposal).
async function approveMany(items){
  let okCount = 0, failCount = 0;
  for(const p of items){
    if(!proposals.some(x => x.id === p.id)) continue; // ya se resolvió en una vuelta anterior
    if(await approveProposal(p)) okCount++; else failCount++;
  }
  renderPropList();
  toast(failCount === 0 ? `✓ ${okCount} propuesta(s) aprobada(s)` : `✓ ${okCount} aprobada(s), ${failCount} con conflicto de horario (quedaron pendientes)`);
}

function approveAllProposals(){
  return approveMany([...proposals]);
}

async function rejectMany(items){
  for(const p of items){
    if(proposals.some(x => x.id === p.id)) await removeProposal(p.id);
  }
  renderPropList();
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

  // Agrupadas por quién las mandó: "Camila (4)" con aprobar/rechazar todas
  // las de esa persona, además de cada una individual — así no hay que ir
  // una por una si vienen en tanda del mismo invitado.
  const groups = new Map();
  proposals.forEach(p => {
    const who = p.proposedBy || 'Sin nombre';
    if(!groups.has(who)) groups.set(who, []);
    groups.get(who).push(p);
  });

  groups.forEach((items, who) => {
    const group = document.createElement('div');
    group.className = 'prop-group';

    const header = document.createElement('div');
    header.className = 'prop-group-header';
    const title = document.createElement('span');
    title.textContent = `${who} (${items.length})`;
    const okAll = document.createElement('button');
    okAll.className = 'btn'; okAll.textContent = '✓ Todas';
    okAll.onclick = () => approveMany(items);
    const noAll = document.createElement('button');
    noAll.className = 'btn'; noAll.textContent = '✕ Todas';
    noAll.onclick = () => rejectMany(items);
    header.append(title, okAll, noAll);
    group.appendChild(header);

    items.forEach(p => {
      const a = activityMap[p.actId] || activityMap.free;
      const row = document.createElement('div');
      row.className = 'act-row';
      const label = document.createElement('span');
      label.style.cssText = 'flex:1;font-size:12px;';
      label.textContent = `${days[p.d]} ${String(p.h).padStart(2, '0')}:00–${String(p.h + 1).padStart(2, '0')}:00 → ${(a.icon ? a.icon + ' ' : '') + a.label}`;
      const ok = document.createElement('button');
      ok.className = 'btn'; ok.textContent = '✓';
      ok.onclick = async () => { await approveProposal(p); renderPropList(); };
      const no = document.createElement('button');
      no.className = 'btn'; no.textContent = '✕';
      no.onclick = async () => { await removeProposal(p.id); renderPropList(); };
      row.append(label, ok, no);
      group.appendChild(row);
    });

    list.appendChild(group);
  });
}

async function copyProposalsText(){
  if(proposals.length === 0){ toast('No tienes propuestas pendientes'); return; }
  const lines = proposals.map(p => {
    const a = activityMap[p.actId] || activityMap.free;
    return `${days[p.d]} ${String(p.h).padStart(2, '0')}:00–${String(p.h + 1).padStart(2, '0')}:00 → ${(a.icon ? a.icon + ' ' : '') + a.label}`;
  });
  const who = guestName ? ` de ${guestName}` : '';
  const text = `Propuestas de horario${who}:\n` + lines.join('\n');
  try{
    await navigator.clipboard.writeText(text);
    toast('📋 Copiado — envíaselo al propietario');
  }catch(e){
    toast('No se pudo copiar automáticamente');
  }
}
