// index.js — servidor Express: sirve el frontend estático (public/) y monta
// la API (/api/*) que reemplaza el localStorage de la versión anterior.

require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');

const authRoutes = require('./routes/auth.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const activitiesRoutes = require('./routes/activities.routes');
const eventsRoutes = require('./routes/events.routes');
const proposalsRoutes = require('./routes/proposals.routes');
const bookingRoutes = require('./routes/booking.routes');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/proposals', proposalsRoutes);
app.use('/api', bookingRoutes); // /api/availability, /api/booking-requests

app.use(express.static(path.join(__dirname, '..', '..', 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = Number(process.env.PORT) || 3000;

initDb()
  .then(() => {
    app.listen(port, () => console.log(`Mi Horario Semanal → http://localhost:${port}`));
  })
  .catch(err => {
    console.error('No se pudo inicializar la base de datos:', err);
    process.exit(1);
  });
