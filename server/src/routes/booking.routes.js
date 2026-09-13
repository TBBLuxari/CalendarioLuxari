// booking.routes.js — disponibilidad real (huecos libres) y solicitudes de
// cita del rol "booking". Aprobar una solicitud crea un evento con fecha real
// (ver events.routes.js / tabla events, source='booking').

const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');
const { getAvailability } = require('../services/availability');
const { notifyOwner } = require('../services/telegram');

const router = express.Router();

function makeId(){ return 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

router.get('/availability', requireAuth, requireRole('owner', 'booking'), async (req, res) => {
  const days = Math.min(60, Math.max(1, Number(req.query.days) || 21));
  res.json(await getAvailability(days));
});

router.get('/booking-requests', requireAuth, requireRole('owner'), async (req, res) => {
  const { rows } = await db.execute('SELECT * FROM booking_requests ORDER BY created_at ASC');
  res.json(rows.map(r => ({
    id: r.id, date: r.date, startHour: r.start_hour, endHour: r.end_hour,
    requesterName: r.requester_name, note: r.note, status: r.status,
  })));
});

router.post('/booking-requests', requireAuth, requireRole('booking'), async (req, res) => {
  const { date, startHour, endHour, requesterName, note = '' } = req.body || {};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'Fecha inválida' });
  if(!(Number.isInteger(startHour) && Number.isInteger(endHour) && startHour >= 0 && endHour <= 24 && startHour < endHour)){
    return res.status(400).json({ error: 'Rango de horas inválido' });
  }
  if(!requesterName || !requesterName.trim()) return res.status(400).json({ error: 'Falta tu nombre' });

  const availability = await getAvailability(60);
  const day = availability.find(d => d.date === date);
  const fits = day && day.freeRanges.some(r => startHour >= r.startHour && endHour <= r.endHour);
  if(!fits) return res.status(409).json({ error: 'Ese horario ya no está libre, elige otro' });

  const id = makeId();
  await db.execute({
    sql: 'INSERT INTO booking_requests(id, date, start_hour, end_hour, requester_name, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, date, startHour, endHour, requesterName.trim(), note, 'pending', new Date().toISOString()],
  });
  res.status(201).json({ id, date, startHour, endHour, requesterName: requesterName.trim(), note, status: 'pending' });

  notifyOwner(`📅 ${requesterName.trim()} pide una cita: ${date} ${String(startHour).padStart(2,'0')}:00–${String(endHour).padStart(2,'0')}:00${note ? ' — ' + note : ''}`);
});

router.post('/booking-requests/:id/approve', requireAuth, requireRole('owner'), async (req, res) => {
  const reqRow = await db.execute({ sql: "SELECT * FROM booking_requests WHERE id = ? AND status = 'pending'", args: [req.params.id] });
  if(reqRow.rows.length === 0) return res.status(404).json({ error: 'Solicitud no encontrada o ya resuelta' });
  const r = reqRow.rows[0];

  const eventId = 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await db.execute({
    sql: 'INSERT INTO events(id, date, start_hour, end_hour, title, notes, source, remind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [eventId, r.date, r.start_hour, r.end_hour, `Cita con ${r.requester_name}`, r.note, 'booking', 1, new Date().toISOString()],
  });
  await db.execute({ sql: "UPDATE booking_requests SET status = 'approved' WHERE id = ?", args: [r.id] });
  res.json({ ok: true, eventId });
});

router.post('/booking-requests/:id/reject', requireAuth, requireRole('owner'), async (req, res) => {
  await db.execute({ sql: "UPDATE booking_requests SET status = 'rejected' WHERE id = ?", args: [req.params.id] });
  res.json({ ok: true });
});

module.exports = router;
