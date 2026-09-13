// events.js — eventos con fecha real, no recurrentes (plazos, entregas,
// citas ya confirmadas). Se editan desde el modal #eventsModal. Las
// solicitudes de cita pendientes tienen su propio modal (ver booking.js) —
// una vez aprobadas, se vuelven un evento como cualquier otro y aparecen acá.

let events = [];

function fmtEventRange(ev){
  const [y, m, d] = ev.date.split('-');
  return `${d}/${m}/${y} · ${String(ev.startHour).padStart(2,'0')}:00–${String(ev.endHour).padStart(2,'0')}:00`;
}

function todayISO(){
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

async function fetchEvents(){
  if(currentRole !== 'owner') return;
  events = await api('/events');
  updateEventsBadge();
  if(typeof renderOverlays === 'function') renderOverlays();
}

function updateEventsBadge(){
  const btn = document.getElementById('eventsBtn');
  if(!btn) return;
  const upcoming = events.filter(e => e.date >= todayISO()).length;
  btn.textContent = `🗓️ Eventos (${upcoming})`;
}

function openEventsModal(){
  renderEventsList();
  document.getElementById('eventsModal').classList.add('show');
}
function closeEventsModal(){
  document.getElementById('eventsModal').classList.remove('show');
}

function renderEventsList(){
  const list = document.getElementById('eventsList');
  list.innerHTML = '';
  const upcoming = events.filter(e => e.date >= todayISO()).sort((a,b) => (a.date + a.startHour) < (b.date + b.startHour) ? -1 : 1);
  if(upcoming.length === 0){
    list.innerHTML = '<div class="act-empty">No tienes eventos próximos.</div>';
    return;
  }
  upcoming.forEach(ev => {
    const row = document.createElement('div');
    row.className = 'act-row event-row';
    const info = document.createElement('span');
    info.className = 'event-info';
    const sourceTag = ev.source === 'booking' ? ' 📅' : '';
    info.innerHTML = `<b>${escapeHtml(ev.title)}</b>${sourceTag}<br><span class="event-when">${fmtEventRange(ev)}</span>`;
    const del = document.createElement('button');
    del.className = 'btn act-del'; del.textContent = '🗑';
    del.onclick = async () => {
      if(!confirm(`¿Borrar "${ev.title}"?`)) return;
      await api('/events/' + ev.id, { method: 'DELETE' });
      events = events.filter(e => e.id !== ev.id);
      renderEventsList();
      updateEventsBadge();
      renderOverlays();
    };
    row.append(info, del);
    list.appendChild(row);
  });
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function populateHourSelect(sel, from, to){
  sel.innerHTML = '';
  for(let h = from; h <= to; h++){
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = String(h).padStart(2, '0') + ':00';
    sel.appendChild(opt);
  }
}
const newEvStartSel = document.getElementById('newEvStart');
const newEvEndSel = document.getElementById('newEvEnd');
if(newEvStartSel && newEvEndSel){
  populateHourSelect(newEvStartSel, 0, 23);
  populateHourSelect(newEvEndSel, 1, 24);
  newEvEndSel.value = 1;
  const dateInput = document.getElementById('newEvDate');
  if(dateInput) dateInput.value = todayISO();
}

const newEventForm = document.getElementById('newEventForm');
if(newEventForm){
  newEventForm.addEventListener('submit', async e => {
    e.preventDefault();
    const date = document.getElementById('newEvDate').value;
    const startHour = Number(document.getElementById('newEvStart').value);
    const endHour = Number(document.getElementById('newEvEnd').value);
    const title = document.getElementById('newEvTitle').value.trim();
    const notes = document.getElementById('newEvNotes').value.trim();
    const remind = document.getElementById('newEvRemind').checked;
    if(!date || !title || endHour <= startHour){
      toast('Revisa fecha, horas y título');
      return;
    }
    try{
      const created = await api('/events', { method: 'POST', body: { date, startHour, endHour, title, notes, remind } });
      events.push(created);
      renderEventsList();
      updateEventsBadge();
      renderOverlays();
      e.target.reset();
      document.getElementById('newEvDate').value = todayISO();
    }catch(err){
      toast('❌ ' + err.message);
    }
  });
}
