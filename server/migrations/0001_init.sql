-- Esquema inicial. Se aplica de forma idempotente (CREATE TABLE IF NOT EXISTS)
-- cada vez que arranca el servidor — ver server/src/db.js.

CREATE TABLE IF NOT EXISTS users (
  role TEXT PRIMARY KEY CHECK(role IN ('owner','guest','booking')),
  password_hash TEXT NOT NULL
);

-- Estado compartido guardado como JSON (por ahora solo el horario semanal).
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT DEFAULT '',
  bg TEXT NOT NULL,
  fg TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Eventos con fecha real (no recurrentes): plazos, entregas, citas confirmadas.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,        -- YYYY-MM-DD
  start_hour INTEGER NOT NULL,
  end_hour INTEGER NOT NULL,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'booking'
  remind INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Propuestas de invitado sobre el horario semanal recurrente (ya existía en el front).
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  day INTEGER NOT NULL,
  hour INTEGER NOT NULL,
  activity_id TEXT NOT NULL,
  proposed_by TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

-- Solicitudes de cita del rol "booking" sobre fechas reales.
CREATE TABLE IF NOT EXISTS booking_requests (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  start_hour INTEGER NOT NULL,
  end_hour INTEGER NOT NULL,
  requester_name TEXT NOT NULL,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at TEXT NOT NULL
);
