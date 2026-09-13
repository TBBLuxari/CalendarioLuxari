// proposals.routes.js — propuestas de invitado sobre el horario semanal
// recurrente (celdas d/h dentro de la cuadrícula de 7x24), no confundir con
// las citas con fecha real (booking.routes.js).

const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();

function makeId(){ return 'prop_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function pad2(n){ return String(n).padStart(2, '0'); }

const DEFAULT_RULES = { startHour: 0, endHour: 24, maxHours: null };

// Reglas del propietario para limitar al invitado: en qué franja horaria
// puede proponer y cuántas horas puede tener pendientes de aprobación a la
// vez (para que no llene el horario entero de una sentada).
async function getGuestRules(){
  const { rows } = await db.execute({ sql: 'SELECT value FROM app_state WHERE key = ?', args: ['guest_rules'] });
  if(rows.length === 0) return DEFAULT_RULES;
  try{ return { ...DEFAULT_RULES, ...JSON.parse(rows[0].value) }; }catch(e){ return DEFAULT_RULES; }
}

router.get('/rules', requireAuth, requireRole('owner', 'guest'), async (req, res) => {
  res.json(await getGuestRules());
});

router.put('/rules', requireAuth, requireRole('owner'), async (req, res) => {
  const { startHour, endHour, maxHours } = req.body || {};
  if(!(Number.isInteger(startHour) && Number.isInteger(endHour) && startHour >= 0 && endHour <= 24 && startHour < endHour)){
    return res.status(400).json({ error: 'Rango de horas inválido' });
  }
  if(maxHours !== null && !(Number.isInteger(maxHours) && maxHours > 0)){
    return res.status(400).json({ error: 'El máximo de horas debe ser un número mayor a 0, o vacío para no limitar' });
  }
  const rules = { startHour, endHour, maxHours };
  await db.execute({
    sql: 'INSERT INTO app_state(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: ['guest_rules', JSON.stringify(rules)],
  });
  res.json(rules);
});

router.get('/', requireAuth, requireRole('owner', 'guest'), async (req, res) => {
  const { rows } = await db.execute('SELECT * FROM proposals ORDER BY created_at ASC');
  res.json(rows.map(r => ({ id: r.id, d: r.day, h: r.hour, actId: r.activity_id, proposedBy: r.proposed_by || '' })));
});

router.post('/', requireAuth, requireRole('guest'), async (req, res) => {
  const { d, h, actId, proposedBy } = req.body || {};
  if(!(Number.isInteger(d) && d >= 0 && d < 7 && Number.isInteger(h) && h >= 0 && h < 24 && actId)){
    return res.status(400).json({ error: 'Propuesta inválida' });
  }

  const rules = await getGuestRules();
  if(h < rules.startHour || h >= rules.endHour){
    return res.status(403).json({ error: `El propietario solo permite proponer entre las ${pad2(rules.startHour)}:00 y las ${pad2(rules.endHour)}:00` });
  }

  const scheduleRow = await db.execute({ sql: 'SELECT value FROM app_state WHERE key = ?', args: ['schedule'] });
  const schedule = JSON.parse(scheduleRow.rows[0].value);
  if(schedule[d][h] !== 'free') return res.status(409).json({ error: 'Esa hora ya está ocupada' });

  if(rules.maxHours !== null){
    const { rows } = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM proposals WHERE NOT (day = ? AND hour = ?)', args: [d, h] });
    if(Number(rows[0].n) >= rules.maxHours){
      return res.status(403).json({ error: `Ya tienes el máximo de ${rules.maxHours} hora(s) propuestas pendientes — espera a que el propietario apruebe o rechace alguna` });
    }
  }

  await db.execute({ sql: 'DELETE FROM proposals WHERE day = ? AND hour = ?', args: [d, h] });
  const id = makeId();
  const proposedByClean = (proposedBy || '').toString().trim().slice(0, 60);
  await db.execute({
    sql: 'INSERT INTO proposals(id, day, hour, activity_id, proposed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, d, h, actId, proposedByClean, new Date().toISOString()],
  });
  res.status(201).json({ id, d, h, actId, proposedBy: proposedByClean });
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
