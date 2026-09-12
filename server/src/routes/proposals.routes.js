// proposals.routes.js — propuestas de invitado sobre el horario semanal
// recurrente (celdas d/h dentro de la cuadrícula de 7x24), no confundir con
// las citas con fecha real (booking.routes.js).

const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();

function makeId(){ return 'prop_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

router.get('/', requireAuth, requireRole('owner', 'guest'), async (req, res) => {
  const { rows } = await db.execute('SELECT * FROM proposals ORDER BY created_at ASC');
  res.json(rows.map(r => ({ id: r.id, d: r.day, h: r.hour, actId: r.activity_id })));
});

router.post('/', requireAuth, requireRole('guest'), async (req, res) => {
  const { d, h, actId } = req.body || {};
  if(!(Number.isInteger(d) && d >= 0 && d < 7 && Number.isInteger(h) && h >= 0 && h < 24 && actId)){
    return res.status(400).json({ error: 'Propuesta inválida' });
  }
  const scheduleRow = await db.execute({ sql: 'SELECT value FROM app_state WHERE key = ?', args: ['schedule'] });
  const schedule = JSON.parse(scheduleRow.rows[0].value);
  if(schedule[d][h] !== 'free') return res.status(409).json({ error: 'Esa hora ya está ocupada' });

  await db.execute({ sql: 'DELETE FROM proposals WHERE day = ? AND hour = ?', args: [d, h] });
  const id = makeId();
  await db.execute({
    sql: 'INSERT INTO proposals(id, day, hour, activity_id, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, d, h, actId, new Date().toISOString()],
  });
  res.status(201).json({ id, d, h, actId });
});

router.delete('/:id', requireAuth, requireRole('owner', 'guest'), async (req, res) => {
  // El invitado solo puede retirar SU propia propuesta pendiente (no hay más
  // control de identidad que el rol, igual que en la versión estática).
  await db.execute({ sql: 'DELETE FROM proposals WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

router.post('/:id/approve', requireAuth, requireRole('owner'), async (req, res) => {
  const propRow = await db.execute({ sql: 'SELECT * FROM proposals WHERE id = ?', args: [req.params.id] });
  if(propRow.rows.length === 0) return res.status(404).json({ error: 'Propuesta no encontrada' });
  const p = propRow.rows[0];

  const scheduleRow = await db.execute({ sql: 'SELECT value FROM app_state WHERE key = ?', args: ['schedule'] });
  const schedule = JSON.parse(scheduleRow.rows[0].value);
  if(schedule[p.day][p.hour] === 'free'){
    schedule[p.day][p.hour] = p.activity_id;
    await db.execute({
      sql: 'UPDATE app_state SET value = ? WHERE key = ?',
      args: [JSON.stringify(schedule), 'schedule'],
    });
  }
  await db.execute({ sql: 'DELETE FROM proposals WHERE id = ?', args: [p.id] });
  res.json({ ok: true });
});

module.exports = router;
