// events.js — eventos con fecha real, no recurrentes (plazos, entregas,
// citas ya confirmadas). Ya no tienen su propio modal: una vez que existen
// (por ahora, solo al aprobar una cita — ver booking.js) se ven directo
// sobre la cuadrícula real si su fecha cae en la semana visible (ver
// renderOverlays en grid.js). Se borran desde la lista en ❤️ Citas (ver
// renderConfirmedEventsSection en booking.js) o con doble clic sobre su
// celda si ya estás viendo esa semana — las dos usan deleteEvent() acá.

let events = [];

async function fetchEvents(){
  if(currentRole !== 'owner') return;
  events = await api('/events');
  if(typeof renderOverlays === 'function') renderOverlays();
}

async function deleteEvent(id){
  const ev = events.find(e => e.id === id);
  if(!ev) return;
  if(!confirm(`¿Borrar "${ev.title}"?`)) return;
  await api('/events/' + id, { method: 'DELETE' });
  events = events.filter(e => e.id !== id);
  if(typeof renderOverlays === 'function') renderOverlays();
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
