// db.js — cliente de base de datos (libSQL: SQLite local en desarrollo,
// Turso remoto en producción, mismo cliente para ambos casos) + inicialización
// de esquema y datos por defecto.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');
const { DEFAULT_SCHEDULE, DEFAULT_ACTIVITIES } = require('./seedDefaults');

const url = process.env.DATABASE_URL || 'file:./server/data/local.db';
if(url.startsWith('file:')){
  const filePath = url.slice('file:'.length);
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

const db = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

async function applySchema(){
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '0001_init.sql'), 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  for(const stmt of statements) await db.execute(stmt);
}

async function seedPasswords(){
  const roles = [
    ['owner', process.env.OWNER_PASSWORD],
    ['guest', process.env.GUEST_PASSWORD],
    ['booking', process.env.BOOKING_PASSWORD],
  ];
  for(const [role, plain] of roles){
    if(!plain) continue; // sin contraseña configurada: ese rol queda deshabilitado
    const hash = await bcrypt.hash(plain, 10);
    await db.execute({
      sql: 'INSERT INTO users(role, password_hash) VALUES (?, ?) ON CONFLICT(role) DO UPDATE SET password_hash = excluded.password_hash',
      args: [role, hash],
    });
  }
}

async function seedDefaultsIfEmpty(){
  const scheduleRow = await db.execute({ sql: 'SELECT value FROM app_state WHERE key = ?', args: ['schedule'] });
  if(scheduleRow.rows.length === 0){
    await db.execute({
      sql: 'INSERT INTO app_state(key, value) VALUES (?, ?)',
      args: ['schedule', JSON.stringify(DEFAULT_SCHEDULE)],
    });
  }

  const actCount = await db.execute('SELECT COUNT(*) AS n FROM activities');
  if(Number(actCount.rows[0].n) === 0){
    for(let i = 0; i < DEFAULT_ACTIVITIES.length; i++){
      const a = DEFAULT_ACTIVITIES[i];
      await db.execute({
        sql: 'INSERT INTO activities(id, label, icon, bg, fg, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        args: [a.id, a.label, a.icon || '', a.bg, a.fg, i],
      });
    }
  }
}

async function initDb(){
  await applySchema();
  await seedPasswords();
  await seedDefaultsIfEmpty();
}

module.exports = { db, initDb };
