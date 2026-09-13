# Mi Horario Semanal

Horario semanal interactivo (24 h × 7 días) con backend propio: Node.js + Express y una base de datos SQLite (local en desarrollo, [Turso](https://turso.tech) en producción). El horario, las actividades, los eventos con fecha y las citas viven en el servidor — cualquier dispositivo con la contraseña correcta ve y edita lo mismo, no algo guardado solo en ese navegador.

> Antes esta app era 100% estática (datos en `localStorage`). Esa versión sigue disponible en la rama [`backup/static-site-pre-backend`](../../tree/backup/static-site-pre-backend) / tag `backup/static-site-2026-09-12` por si hace falta volver atrás.

## Estructura

```
Calendario/
├── server/
│   ├── src/
│   │   ├── index.js            # Express: sirve public/ y monta /api
│   │   ├── db.js                # cliente libSQL + init de esquema y datos por defecto
│   │   ├── seedDefaults.js      # horario/actividades con los que arranca una DB nueva
│   │   ├── auth/middleware.js   # sesión (cookie httpOnly + JWT), requireAuth/requireRole
│   │   ├── routes/               # auth, schedule, activities, events, proposals, booking
│   │   └── services/availability.js  # huecos libres reales para el rol "booking"
│   └── migrations/0001_init.sql
├── public/                      # frontend (HTML/CSS/JS plano, sin build step)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js              # fetch envuelto (cookies same-origin)
│       ├── auth.js             # login/logout contra la API, permisos por rol
│       ├── activities.js       # actividades (CRUD vía API)
│       ├── grid.js             # cuadrícula, pintado, propuestas de invitado
│       ├── events.js           # eventos con fecha real (plazos, entregas, citas)
│       ├── booking.js          # vista de "agendar cita" + panel de aprobación
│       ├── ics.js              # exportar .ics (recurrente + eventos con fecha)
│       ├── notify.js           # avisos en la app (notificación + pitido + alerta bloqueante)
│       └── google-sync.js      # sincronización con un calendario dedicado en Google Calendar
├── package.json
├── .env.example
└── README.md
```

## Desarrollo local

Requiere Node 18+.

```bash
npm install
cp .env.example .env
```

Completa en `.env` al menos `JWT_SECRET` y las contraseñas de los roles que quieras usar (`OWNER_PASSWORD`, `GUEST_PASSWORD`, `BOOKING_PASSWORD` — deja vacía la que no quieras habilitar). No hace falta cuenta en Turso para desarrollar: por defecto usa un archivo SQLite local (`server/data/local.db`, ignorado por git).

```bash
npm run dev
```

Abre `http://localhost:3000`.

## Roles y contraseñas

Ya no hay hashes en el código fuente (antes vivían en `js/auth.js`, visibles en el repo público). Ahora cada contraseña se hashea con `bcrypt` al arrancar el servidor, a partir de las variables de entorno:

- **`owner`** (`OWNER_PASSWORD`): acceso completo — edita el horario, actividades, eventos, aprueba propuestas y citas, sincroniza con Google.
- **`guest`** (`GUEST_PASSWORD`): ve el horario y solo puede **proponer** actividades sobre celdas libres (queda pendiente de aprobación); tiene un botón para copiar el resumen y enviarlo por WhatsApp/mensaje.
- **`booking`** (`BOOKING_PASSWORD`): no ve el horario en absoluto — entra a una vista dedicada con los próximos huecos libres reales (calculados en el servidor) para pedir una cita. Queda pendiente hasta que el propietario la apruebe.

Sesión guardada en una cookie `httpOnly` (JWT, 30 días). Cambiar una contraseña es cambiar la variable de entorno y reiniciar el servidor.

## Las funciones nuevas de esta versión

- **Scroll horizontal real**: la cuadrícula tiene un ancho mínimo por columna en vez de encogerse siempre al ancho de la pantalla, así en móvil se puede desplazar para ver cada día con un tamaño legible (la columna de horas queda fija a la izquierda).
- **Eventos con fecha (no recurrentes)**: botón **🗓️ Eventos**, para plazos, entregas o cualquier cosa puntual — con fecha, hora, notas y recordatorio, separados del horario semanal que se repite.
- **Agendar cita**: rol `booking` dedicado — quien tenga esa contraseña ve tus huecos libres reales (horario semanal menos eventos y otras solicitudes ya pendientes) desde su propio celular, pide una hora, y tú la apruebas o rechazas desde **🗓️ Eventos**. Al aprobarla se crea un evento real que puedes sincronizar con Google.
- **Avisos más insistentes**: tanto al sincronizar con Google como al exportar `.ics`, cada bloque/evento lleva varios recordatorios (dos avisos emergentes + uno por correo) en vez de uno solo. **Importante:** el volumen, la vibración y qué tan "imposible de ignorar" es la notificación en el celular lo controla la app de Google Calendar (Ajustes → Notificaciones), no algo que la API pueda forzar — si la sigues ignorando, sube ahí la prioridad de las notificaciones de ese calendario.

## Sincronización con Google Calendar

Sigue siendo 100% del lado del cliente (OAuth de tu propia cuenta, sin pasar por el backend): sube tu horario semanal y tus eventos con fecha a un calendario **separado y dedicado** ("Mi Horario Semanal"), sin tocar tu calendario principal.

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto, habilita la **Google Calendar API**, configura la pantalla de consentimiento OAuth (tipo Externo, agrega tu cuenta como usuario de prueba, permiso `.../auth/calendar`) y crea un **ID de cliente de OAuth** de tipo "Aplicación web".
2. En "Orígenes autorizados de JavaScript" agrega el dominio donde despliegues la app (el de Render) y `http://localhost:3000` para desarrollo.
3. Copia el Client ID en `GOOGLE_CLIENT_ID` dentro de [public/js/google-sync.js](public/js/google-sync.js). No es secreto — puede quedar en el repo público.

## Despliegue (gratis, sin tarjeta)

1. **Base de datos — [Turso](https://turso.tech):** crea una cuenta y una base de datos, copia la URL (`libsql://...`) y el token de autenticación.
2. **Servidor — [Render](https://render.com), "New Web Service":** conéctalo a este repo de GitHub.
   - Build command: `npm install`
   - Start command: `npm start`
   - Variables de entorno: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `JWT_SECRET`, `OWNER_PASSWORD`, `GUEST_PASSWORD`, `BOOKING_PASSWORD`, y opcionalmente `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (ver más abajo).
3. Cada push a `main` re-despliega solo. El plan gratuito de Render "duerme" el servicio tras ~15 min sin visitas y tarda unos segundos en despertar en la siguiente visita — aceptable para uso personal/familiar. Si eso molesta, la alternativa es Fly.io (no se duerme, pide tarjeta) o un plan de pago de Render/DigitalOcean.

GitHub Pages **ya no sirve la app en vivo** (no puede correr Node) — el repo sigue en GitHub como código fuente, pero el sitio real ahora vive en Render.

## Notificaciones para seguir el horario

Cuatro mecanismos, pensados para complementarse:

- **📆 Sincronizar Google** / **🔄 Traer de Google**: ver arriba.
- **📅 Exportar .ics**: genera `mi-horario.ics` con el horario recurrente + tus eventos con fecha, para importar en cualquier app de calendario.
- **🔔 Avisos**: notificación del navegador + pitido fuerte + alerta de pantalla completa que no se cierra sola, mientras la pestaña esté abierta (horario semanal y eventos con recordatorio). No es confiable en el celular si el navegador queda en segundo plano — para eso está la sincronización con Google.
- **📲 Aviso a Telegram** cuando alguien te propone algo (invitado) o pide una cita: llega al celular al instante, sin necesidad de tener la app abierta. Opcional — ver siguiente sección.

## Aviso a Telegram (opcional)

Cuando un invitado envía una propuesta o alguien pide una cita, el servidor le manda un mensaje a tu Telegram. Si no configuras esto, simplemente no se manda ningún aviso — el resto de la app funciona igual.

1. En Telegram, busca **@BotFather**, ábrele el chat y envía `/newbot`. Ponle un nombre para mostrar y un usuario único terminado en "bot".
2. Copia el **token** que te da (algo como `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) → variable `TELEGRAM_BOT_TOKEN`.
3. Busca tu bot recién creado (por el usuario que le pusiste) y mándale cualquier mensaje (ej. "hola") — si no le escribes primero, no puede responderte.
4. Abre en el navegador `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` (con tu token real) y busca `"chat":{"id":` en el JSON — ese número es tu **chat_id** → variable `TELEGRAM_CHAT_ID`.
5. Agrega ambas variables en `.env` (desarrollo local) y/o en las variables de entorno de Render (producción) y reinicia el servidor.

## Pendiente / decisiones abiertas

- El rol `guest` y el rol `booking` no tienen más control de identidad que la contraseña compartida (igual que antes) — pensado para 2-3 personas de confianza, no para uso público masivo.
- No hay recuperación de contraseña ni gestión de usuarios desde la UI: todo se configura por variables de entorno en el servidor.
