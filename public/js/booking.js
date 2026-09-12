// booking.js — dos caras de la misma función:
//  1) Rol "booking": vista dedicada (#bookingView) para ver huecos libres
//     reales de los próximos días y pedir una cita.
//  2) Rol "owner": sección dentro de #eventsModal para aprobar/rechazar esas
//     solicitudes (aprobar crea un evento real — ver events.js/backend).

const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
let bookingRequests = [];

/* ---------- Vista del solicitante (rol "booking") ---------- */

async function initBookingView(){
  document.getElementById('bookingView').classList.add('show');
  await renderAvailabilityPicker();
}

function fmtDateLong(dateStr){
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]} ${d}/${m}`;
}

async function renderAvailabilityPicker(){
  const box = document.getElementById('availabilityList');
  box.innerHTML = '<div class="act-empty">Cargando disponibilidad…</div>';
  const availability = await api('/availability?days=21');
  box.innerHTML = '';
  const withFree = availability.filter(d => d.freeRanges.length > 0);
  if(withFree.length === 0){
    box.innerHTML = '<div class="act-empty">No hay huecos libres en los próximos días.</div>';
    return;
  }
  withFree.forEach(day => {
    const card = document.createElement('div');
    card.className = 'avail-day';
    const h = document.createElement('div');
    h.className = 'avail-day-title';
    h.textContent = fmtDateLong(day.date);
    card.appendChild(h);
    const chips = document.createElement('div');
    chips.className = 'avail-chips';
    day.freeRanges.forEach(r => {
      const chip = document.createElement('button');
      chip.className = 'btn avail-chip';
      chip.textContent = `${String(r.startHour).padStart(2,'0')}:00–${String(r.endHour).padStart(2,'0')}:00`;
      chip.onclick = () => openBookingForm(day.date, r);
      chips.appendChild(chip);
    });
    card.appendChild(chips);
    box.appendChild(card);
  });
}

function openBookingForm(date, range){
  const form = document.getElementById('bookingForm');
  form.classList.add('show');
  form.dataset.date = date;
  const startSel = document.getElementById('bkStart');
  startSel.innerHTML = '';
  for(let h = range.startHour; h < range.endHour; h++){
    const opt = document.createElement('option');
    opt.value = h; opt.textContent = String(h).padStart(2,'0') + ':00';
    startSel.appendChild(opt);
  }
  const durSel = document.getElementById('bkDuration');
  durSel.innerHTML = '';
  const maxDur = range.endHour - range.startHour;
  for(let n = 1; n <= Math.min(4, maxDur); n++){
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n + (n === 1 ? ' hora' : ' horas');
    durSel.appendChild(opt);
  }
  document.getElementById('bkRangeLabel').textContent = `${fmtDateLong(date)}, entre ${String(range.startHour).padStart(2,'0')}:00 y ${String(range.endHour).padStart(2,'0')}:00`;
  form.dataset.maxEnd = range.endHour;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeBookingForm(){
  document.getElementById('bookingForm').classList.remove('show');
}

const bookingForm = document.getElementById('bookingForm');
if(bookingForm){
  bookingForm.addEventListener('submit', async e => {
    e.preventDefault();
    const date = bookingForm.dataset.date;
    const startHour = Number(document.getElementById('bkStart').value);
    const duration = Number(document.getElementById('bkDuration').value);
    const endHour = Math.min(startHour + duration, Number(bookingForm.dataset.maxEnd));
    const requesterName = document.getElementById('bkName').value.trim();
    const note = document.getElementById('bkNote').value.trim();
    if(!requesterName){ toast('Escribe tu nombre'); return; }
    try{
      await api('/booking-requests', { method: 'POST', body: { date, startHour, endHour, requesterName, note } });
      toast('✓ Solicitud enviada — espera la confirmación');
      closeBookingForm();
      bookingForm.reset();
      await renderAvailabilityPicker();
    }catch(err){
      toast('❌ ' + err.message);
      await renderAvailabilityPicker();
    }
  });
}

/* ---------- Panel del propietario (dentro de #eventsModal) ---------- */

async function fetchBookingRequests(){
  if(currentRole !== 'owner') return;
  bookingRequests = await api('/booking-requests');
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
    label.innerHTML = `<b>${escapeHtml(r.requesterName)}</b> — ${fmtDateLong(r.date)} ${String(r.startHour).padStart(2,'0')}:00–${String(r.endHour).padStart(2,'0')}:00${r.note ? '<br><span class="event-when">' + escapeHtml(r.note) + '</span>' : ''}`;
    const ok = document.createElement('button');
    ok.className = 'btn'; ok.textContent = '✓ Aprobar';
    ok.onclick = async () => {
      await api('/booking-requests/' + r.id + '/approve', { method: 'POST' });
      await Promise.all([fetchBookingRequests(), fetchEvents()]);
      renderBookingRequestsSection();
      renderEventsList();
      updateEventsBadge();
      toast('✓ Cita confirmada');
    };
    const no = document.createElement('button');
    no.className = 'btn'; no.textContent = '✕ Rechazar';
    no.onclick = async () => {
      await api('/booking-requests/' + r.id + '/reject', { method: 'POST' });
      await fetchBookingRequests();
      renderBookingRequestsSection();
      updateEventsBadge();
    };
    row.append(label, ok, no);
    box.appendChild(row);
  });
}
