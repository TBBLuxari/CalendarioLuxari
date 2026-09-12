// availability.js — calcula huecos libres reales para los próximos N días,
// cruzando el horario semanal recurrente con los eventos ya agendados y las
// solicitudes de cita pendientes (para que dos personas no pidan la misma hora).

const { db } = require('../db');

function pad2(n){ return String(n).padStart(2, '0'); }
function toDateStr(d){ return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

// Mismo mapeo que el front: 0=lunes ... 6=domingo (JS: 0=domingo).
function weekdayIndex(date){
  return (date.getDay() + 6) % 7;
}

function rangesFromFreeHours(freeHours){
  const ranges = [];
  let start = null;
  for(let h = 0; h <= 24; h++){
    const free = h < 24 && freeHours[h];
    if(free && start === null) start = h;
    if(!free && start !== null){ ranges.push({ startHour: start, endHour: h }); start = null; }
  }
  return ranges;
}

async function getAvailability(days){
  const scheduleRow = await db.execute({ sql: 'SELECT value FROM app_state WHERE key = ?', args: ['schedule'] });
  const schedule = JSON.parse(scheduleRow.rows[0].value);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(today); rangeEnd.setDate(rangeEnd.getDate() + days);
  const startStr = toDateStr(today);
  const endStr = toDateStr(rangeEnd);

  const [eventsRes, requestsRes] = await Promise.all([
    db.execute({ sql: 'SELECT date, start_hour, end_hour FROM events WHERE date >= ? AND date < ?', args: [startStr, endStr] }),
    db.execute({ sql: "SELECT date, start_hour, end_hour FROM booking_requests WHERE status = 'pending' AND date >= ? AND date < ?", args: [startStr, endStr] }),
  ]);
  const busyByDate = {};
  for(const row of [...eventsRes.rows, ...requestsRes.rows]){
    (busyByDate[row.date] ||= []).push({ start: Number(row.start_hour), end: Number(row.end_hour) });
  }

  const now = new Date();
  const days_out = [];
  for(let i = 0; i < days; i++){
    const date = new Date(today); date.setDate(date.getDate() + i);
    const dateStr = toDateStr(date);
    const weekday = weekdayIndex(date);
    const freeHours = Array.from({ length: 24 }, (_, h) => schedule[weekday][h] === 'free');

    (busyByDate[dateStr] || []).forEach(b => {
      for(let h = b.start; h < b.end; h++) freeHours[h] = false;
    });

    if(i === 0){
      const currentHour = now.getHours();
      for(let h = 0; h <= currentHour; h++) freeHours[h] = false;
    }

    days_out.push({ date: dateStr, freeRanges: rangesFromFreeHours(freeHours) });
  }
  return days_out;
}

module.exports = { getAvailability, weekdayIndex, toDateStr };
