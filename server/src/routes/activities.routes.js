const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();

function makeId(){
  return 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

router.get('/', requireAuth, requireRole('owner', 'guest'), async (req, res) => {
  const { rows } = await db.execute('SELECT id, label, icon, bg, fg FROM activities ORDER BY sort_order ASC');
  res.json(rows);
});

router.post('/', requireAuth, requireRole('owner'), async (req, res) => {
  const { label, icon, bg, fg } = req.body || {};
  if(!label || !bg || !fg) return res.status(400).json({ error: 'Faltan campos (label, bg, fg)' });
  const id = makeId();
  const { rows } = await db.execute('SELECT COALESCE(MAX(sort_order), -1) AS m FROM activities');
  await db.execute({
    sql: 'INSERT INTO activities(id, label, icon, bg, fg, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, label, icon || '', bg, fg, Number(rows[0].m) + 1],
  });
  res.status(201).json({ id, label, icon: icon || '', bg, fg });
});

// Reemplaza la lista completa (usado al "Traer de Google", que reconstruye
// las actividades tal como estaban cuando se sincronizaron, preservando sus
// ids originales — por eso no reutiliza POST, que siempre genera un id nuevo).
router.put('/', requireAuth, requireRole('owner'), async (req, res) => {
  const list = req.body;
  if(!Array.isArray(list) || !list.some(a => a.id === 'free')){
    return res.status(400).json({ error: 'La lista de actividades debe incluir "free"' });
  }
  await db.execute('DELETE FROM activities');
  for(let i = 0; i < list.length; i++){
    const a = list[i];
    await db.execute({
      sql: 'INSERT INTO activities(id, label, icon, bg, fg, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      args: [a.id, a.label, a.icon || '', a.bg, a.fg, i],
    });
  }
  res.json(list);
});

router.put('/:id', requireAuth, requireRole('owner'), async (req, res) => {
  const { id } = req.params;
  const current = await db.execute({ sql: 'SELECT * FROM activities WHERE id = ?', args: [id] });
  if(current.rows.length === 0) return res.status(404).json({ error: 'Actividad no encontrada' });
  const prev = current.rows[0];
  const { label = prev.label, icon = prev.icon, bg = prev.bg, fg = prev.fg } = req.body || {};
  await db.execute({
    sql: 'UPDATE activities SET label = ?, icon = ?, bg = ?, fg = ? WHERE id = ?',
    args: [label, icon, bg, fg, id],
  });
  res.json({ id, label, icon, bg, fg });
});

router.delete('/:id', requireAuth, requireRole('owner'), async (req, res) => {
  const { id } = req.params;
  if(id === 'free') return res.status(400).json({ error: '"Libre" no se puede borrar' });
  await db.execute({ sql: 'DELETE FROM activities WHERE id = ?', args: [id] });
  res.json({ ok: true });
});

module.exports = router;
