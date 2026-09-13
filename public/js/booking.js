// booking.js — dos caras de la misma función:
//  1) Rol "booking": ve la cuadrícula real (igual que el invitado, a
//     propósito — ver activities/schedule.routes.js) y con "Modo agendar"
//     activo, elige una casilla libre para pedir una cita con fecha real.
//  2) Rol "owner": sección dentro de #eventsModal para aprobar/rechazar esas
//     solicitudes (aprobar crea un evento real — ver events.js/backend).

const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
let bookingRequests = [];
let bookingPickMode = false;
let bookingAvailability = [];
let bookingName = localStorage.getItem('hs_booking_name') || '';

/* ---------- Vista del solicitante (rol "booking") ---------- */

function toggleBookingPickMode(){
  bookingPickMode = !bookingPickMode;
  const btn = document.getElementById('bookingPickBtn');
  if(btn){
    btn.textContent = bookingPickMode ? '📅 Modo agendar: ON' : '📅 Modo agendar: OFF';
    btn.classList.toggle('on', bookingPickMode);
  }
  toast(bookingPickMode ? 'Toca una casilla libre para pedir esa hora' : 'Puedes desplazarte libremente sin agendar');
}

function setBookingName(name){
  bookingName = name.trim();
  localStorage.setItem('hs_booking_name', bookingName);
}

async function fetchBookingAvailability(){
  bookingAvailability = await api('/availability?days=28');
}

function weekdayIndexOfDate(dateStr){
  const [y, m, d] = dateStr.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7; // 0=lunes … 6=domingo
}

// Busca, entre los próximos días ya calculados por el servidor (huecos reales
// — descuentan eventos y otras solicitudes pendientes), la primera fecha real
// que caiga en el mismo día de la semana que la celda tocada y donde esa hora
// siga libre.
function findNextFreeOccurrence(d, h){
  for(const day of bookingAvailability){
    if(weekdayIndexOfDate(day.date) !== d) continue;
    const range = day.freeRanges.find(r => h >= r.startHour && h < r.endHour);
    if(range) return { date: day.date, range };
  }
  return null;
}

function fmtDateLong(dateStr){
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]} ${d}/${m}`;
}

function openBookingModal(d, h, date, range){
  const modal = document.getElementById('bookingModal');
  modal.dataset.date = date;
  modal.dataset.maxEnd = range.endHour;

  const startSel = document.getElementById('bkStart');
  startSel.innerHTML = '';
  for(let hh = range.startHour; hh < range.endHour; hh++) startSel.add(new Option(String(hh).padStart(2, '0') + ':00', hh));
  startSel.value = h;

  const durSel = document.getElementById('bkDuration');
  durSel.innerHTML = '';
  const maxDur = range.endHour - h;
  for(let n = 1; n <= Math.min(4, maxDur); n++) durSel.add(new Option(n + (n === 1 ? ' hora' : ' horas'), n));

  document.getElementById('bkDateLabel').textContent = `${fmtDateLong(date)} — entre ${String(range.startHour).padStart(2,'0')}:00 y ${String(range.endHour).padStart(2,'0')}:00`;
  document.getElementById('bkName').value = bookingName;
  document.getElementById('bkType').value = '🌆 Salida';
  document.getElementById('bkTypeOther').value = '';
  document.getElementById('bkTypeOther').hidden = true;
  modal.classList.add('show');
}

const bkTypeSel = document.getElementById('bkType');
if(bkTypeSel){
  bkTypeSel.addEventListener('change', () => {
    document.getElementById('bkTypeOther').hidden = bkTypeSel.value !== '__other__';
  });
}

function closeBookingModal(){
  document.getElementById('bookingModal').classList.remove('show');
}

const bookingModalForm = document.getElementById('bookingModalForm');
if(bookingModalForm){
  bookingModalForm.addEventListener('submit', async e => {
    e.preventDefault();
    const modal = document.getElementById('bookingModal');
    const date = modal.dataset.date;
    const startHour = Number(document.getElementById('bkStart').value);
    const duration = Number(document.getElementById('bkDuration').value);
    const endHour = Math.min(startHour + duration, Number(modal.dataset.maxEnd));
    const requesterName = document.getElementById('bkName').value.trim();
    const typeSel = document.getElementById('bkType').value;
    const dateType = typeSel === '__other__' ? document.getElementById('bkTypeOther').value.trim() : typeSel;
    const budget = document.getElementById('bkBudget').value.trim();
    const paymentMethod = document.getElementById('bkPayment').value;
    const note = document.getElementById('bkNote').value.trim();
    if(!requesterName){ toast('Escribe tu nombre'); return; }
    setBookingName(requesterName);
    try{
      await api('/booking-requests', { method: 'POST', body: { date, startHour, endHour, requesterName, note, dateType, budget, paymentMethod } });
      toast(`✓ Solicitud enviada — gracias, ${requesterName}`);
      closeBookingModal();
      bookingModalForm.reset();
      // Igual que el invitado: la sesión se cierra sola tras pedir la cita,
      // lista para que la use otra persona sin arrastrar nombre ni estado.
      setTimeout(() => logout(), 1800);
    }catch(err){
      toast('❌ ' + err.message);
      await fetchBookingAvailability();
    }
  });
}

/* ---------- Panel del propietario: ❤️ Citas (modal propio) ---------- */

async function fetchBookingRequests(){
  if(currentRole !== 'owner') return;
  bookingRequests = await api('/booking-requests');
  updateCitasBadge();
}

function updateCitasBadge(){
  const btn = document.getElementById('citasBtn');
  if(!btn) return;
  const pending = bookingRequests.filter(r => r.status === 'pending').length;
  btn.textContent = `❤️ Citas (${pending})`;
  btn.classList.toggle('on', pending > 0);
}

function openCitasModal(){
  renderBookingRequestsSection();
  renderConfirmedEventsSection();
  document.getElementById('citasModal').classList.add('show');
}
function closeCitasModal(){
  document.getElementById('citasModal').classList.remove('show');
}

// Eventos ya confirmados (citas aprobadas y cualquier otro evento con fecha)
// con botón de borrar de una — sin esto, la única forma era doble clic sobre
// la celda exacta viendo la semana exacta, muy poco descubrible.
function renderConfirmedEventsSection(){
  const box = document.getElementById('confirmedEventsList');
  if(!box) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter(e => e.date >= todayStr).sort((a, b) => (a.date + a.startHour) < (b.date + b.startHour) ? -1 : 1);
  box.innerHTML = '';
  if(upcoming.length === 0){
    box.innerHTML = '<div class="act-empty">No tienes citas ni eventos próximos.</div>';
    return;
  }
  upcoming.forEach(ev => {
    const row = document.createElement('div');
    row.className = 'act-row';
    const label = document.createElement('span');
    label.style.cssText = 'flex:1;font-size:12px;';
    const icon = ev.source === 'booking' ? '❤️' : '📌';
    label.innerHTML = `${icon} <b>${escapeHtml(ev.title)}</b> — ${fmtDateLong(ev.date)} ${String(ev.startHour).padStart(2,'0')}:00–${String(ev.endHour).padStart(2,'0')}:00`
      + (ev.notes ? `<br><span class="event-when">${escapeHtml(ev.notes)}</span>` : '');
    const del = document.createElement('button');
    del.className = 'btn act-del'; del.textContent = '🗑';
    del.onclick = async () => { await deleteEvent(ev.id); renderConfirmedEventsSection(); };
    row.append(label, del);
    box.appendChild(row);
  });
}

function renderBookingRequestsSection(){
  const box = document.getElementById('bookingRequestsList');
  if(!box) return;
  const pending = bookingRequests.filter(r => r.status === 'pending');
  box.innerHTML = '';
  if(pending.length === 0){
    box.innerHTML = '<div class="act-empty">No hay solicitudes de cita pendientes.</div>';
    return;
  }
  pending.forEach(r => {
    const row = document.createElement('div');
    row.className = 'act-row';
    const label = document.createElement('span');
    label.style.cssText = 'flex:1;font-size:12px;';
    const extra = [r.dateType, r.budget && `💰 ${r.budget}`, r.paymentMethod].filter(Boolean).map(escapeHtml).join(' · ');
    label.innerHTML = `<b>${escapeHtml(r.requesterName)}</b> — ${fmtDateLong(r.date)} ${String(r.startHour).padStart(2,'0')}:00–${String(r.endHour).padStart(2,'0')}:00`
      + (extra ? `<br><span class="event-when">${extra}</span>` : '')
      + (r.note ? `<br><span class="event-when">${escapeHtml(r.note)}</span>` : '');
    const ok = document.createElement('button');
    ok.className = 'btn'; ok.textContent = '✓ Aprobar';
    ok.onclick = async () => {
      // aprobar crea un evento real (ver backend) — fetchEvents() ya refresca
      // la cuadrícula (renderOverlays), así la ves de una en tu calendario.
      await api('/booking-requests/' + r.id + '/approve', { method: 'POST' });
      await Promise.all([fetchBookingRequests(), fetchEvents()]);
      renderBookingRequestsSection();
      toast('✓ Cita confirmada — ya aparece en tu horario');
    };
    const no = document.createElement('button');
    no.className = 'btn'; no.textContent = '✕ Rechazar';
    no.onclick = async () => {
      await api('/booking-requests/' + r.id + '/reject', { method: 'POST' });
      await fetchBookingRequests();
      renderBookingRequestsSection();
    };
    row.append(label, ok, no);
    box.appendChild(row);
  });
}
