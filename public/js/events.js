// events.js — eventos con fecha real, no recurrentes (plazos, entregas,
// citas ya confirmadas). Ya no tienen su propio modal: una vez que existen
// (por ahora, solo al aprobar una cita — ver booking.js) se ven directo
// sobre la cuadrícula real si su fecha cae en la semana visible (ver
// renderOverlays en grid.js), y se borran con doble clic sobre esa celda.

let events = [];

async function fetchEvents(){
  if(currentRole !== 'owner') return;
  events = await api('/events');
  if(typeof renderOverlays === 'function') renderOverlays();
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
