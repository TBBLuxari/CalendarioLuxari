const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { COOKIE_NAME, signSession, requireAuth } = require('../auth/middleware');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

router.post('/login', async (req, res) => {
  const { password } = req.body || {};
  if(!password) return res.status(400).json({ error: 'Falta la contraseña' });

  const { rows } = await db.execute('SELECT role, password_hash FROM users');
  for(const row of rows){
    if(await bcrypt.compare(password, row.password_hash)){
      res.cookie(COOKIE_NAME, signSession(row.role), COOKIE_OPTS);
      return res.json({ role: row.role });
    }
  }
  return res.status(401).json({ error: 'Contraseña incorrecta' });
});

router.post('/logout', (req, res) => {
  const { maxAge, ...clearOpts } = COOKIE_OPTS;
  res.clearCookie(COOKIE_NAME, clearOpts);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ role: req.role });
});

module.exports = router;
