// ics.js — exporta el horario como eventos semanales recurrentes (.ics) para
// Google/Apple/Outlook Calendar, con una alarma al inicio de cada bloque.
// Las celdas "Libre" no generan evento (no tiene sentido recordarte estar libre).

function pad2(n){ return n.toString().padStart(2, '0'); }

function icsLocalDate(date){
  return date.getFullYear() + pad2(date.getMonth() + 1) + pad2(date.getDate()) +
    'T' + pad2(date.getHours()) + pad2(date.getMinutes()) + '00';
}

function icsStampUTC(date){
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function icsEscape(s){
  return String(s).replace(/[\\,;]/g, m => '\\' + m);
}

// Bloques contiguos de la misma actividad dentro de un día (no cruza medianoche).
function buildDayBlocks(d){
  const blocks = [];
  let h = 0;
  while(h < 24){
    const id = data[d][h];
    if(id === 'free'){ h++; continue; }
    const start = h;
    while(h < 24 && data[d][h] === id) h++;
    blocks.push({start, end: h, id});
  }
  return blocks;
}

function nextMonday(){
  const now = new Date();
  const day = now.getDay(); // 0=domingo..6=sábado
  const diff = day === 0 ? -6 : 1 - day; // retrocede al lunes de esta semana
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function buildICS(){
  const monday = nextMonday();
  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mi Horario Semanal//ES',
    'CALSCALE:GREGORIAN',
  ];

  for(let d = 0; d < 7; d++){
    const blocks = buildDayBlocks(d);
    blocks.forEach((b, idx) => {
      const a = activityMap[b.id] || activityMap.free;
      const startDate = new Date(monday);
      startDate.setDate(monday.getDate() + d);
      startDate.setHours(b.start, 0, 0, 0);
      const endDate = new Date(monday);
      endDate.setDate(monday.getDate() + d);
      endDate.setHours(b.end, 0, 0, 0); // b.end puede ser 24 → JS lo pasa al día siguiente

      const summary = (a.icon ? a.icon + ' ' : '') + a.label;
      const uid = `hs-${d}-${b.start}-${b.id}-${idx}@mi-horario-semanal`;

      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + uid);
      lines.push('DTSTAMP:' + icsStampUTC(now));
      lines.push('DTSTART:' + icsLocalDate(startDate));
      lines.push('DTEND:' + icsLocalDate(endDate));
      lines.push('RRULE:FREQ=WEEKLY');
      lines.push('SUMMARY:' + icsEscape(summary));
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:' + icsEscape(summary));
      lines.push('TRIGGER:-PT0M');
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    });
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadFile(content, filename, mime){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportICS(){
  const ics = buildICS();
  downloadFile(ics, 'mi-horario.ics', 'text/calendar');
  toast('📅 .ics exportado — impórtalo en tu calendario');
}
