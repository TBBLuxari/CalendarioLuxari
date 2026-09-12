const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();

function makeId(){ return 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function validate(body){
  const { date, startHour, endHour, title } = body || {};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Fecha inválida (YYYY-MM-DD)';
  if(!(Number.isInteger(startHour) && Number.isInteger(endHour) && startHour >= 0 && endHour <= 24 && startHour < endHour)) return 'Rango de horas inválido';
  if(!title || !title.trim()) return 'Falta el título';
  return null;
}

router.get('/', requireAuth, requireRole('owner'), async (req, res) => {
  const { rows } = await db.execute('SELECT * FROM events ORDER BY date ASC, start_hour ASC');
  res.json(rows.map(r => ({ id: r.id, date: r.date, startHour: r.start_hour, endHour: r.end_hour, title: r.title, notes: r.notes, source: r.source, remind: !!r.remind })));
});

router.post('/', requireAuth, requireRole('owner'), async (req, res) => {
  const err = validate(req.body);
  if(err) return res.status(400).json({ error: err });
  const { date, startHour, endHour, title, notes = '', remind = true } = req.body;
  const id = makeId();
  await db.execute({
    sql: 'INSERT INTO events(id, date, start_hour, end_hour, title, notes, source, remind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, date, startHour, endHour, title.trim(), notes, 'manual', remind ? 1 : 0, new Date().toISOString()],
  });
  res.status(201).json({ id, date, startHour, endHour, title: title.trim(), notes, source: 'manual', remind: !!remind });
});

router.put('/:id', requireAuth, requireRole('owner'), async (req, res) => {
  const { id } = req.params;
  const current = await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] });
  if(current.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });
  const prev = current.rows[0];
  const merged = {
    date: req.body?.date ?? prev.date,
    startHour: req.body?.startHour ?? prev.start_hour,
    endHour: req.body?.endHour ?? prev.end_hour,
    title: req.body?.title ?? prev.title,
    notes: req.body?.notes ?? prev.notes,
    remind: req.body?.remind ?? !!prev.remind,
  };
  const err = validate(merged);
  if(err) return res.status(400).json({ error: err });
  await db.execute({
    sql: 'UPDATE events SET date=?, start_hour=?, end_hour=?, title=?, notes=?, remind=? WHERE id=?',
    args: [merged.date, merged.startHour, merged.endHour, merged.title.trim(), merged.notes, merged.remind ? 1 : 0, id],
  });
  res.json({ id, ...merged, source: prev.source });
});

router.delete('/:id', requireAuth, requireRole('owner'), async (req, res) => {
  await db.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

module.exports = router;
