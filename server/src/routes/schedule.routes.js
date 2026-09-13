const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();

router.get('/', requireAuth, requireRole('owner', 'guest', 'booking'), async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT value FROM app_state WHERE key = ?', args: ['schedule'] });
  res.json(JSON.parse(rows[0].value));
});

router.put('/', requireAuth, requireRole('owner'), async (req, res) => {
  const data = req.body;
  if(!Array.isArray(data) || data.length !== 7 || data.some(day => !Array.isArray(day) || day.length !== 24)){
    return res.status(400).json({ error: 'El horario debe ser una matriz de 7 días x 24 horas' });
  }
  await db.execute({
    sql: 'INSERT INTO app_state(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: ['schedule', JSON.stringify(data)],
  });
  res.json({ ok: true });
});

module.exports = router;
