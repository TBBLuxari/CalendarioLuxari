# Mi Horario Semanal

Horario semanal interactivo (24 h × 7 días) que corre completamente en el navegador, sin backend. Los datos se guardan en `localStorage`.

## Estructura

```
Calendario/
├── index.html        # Marcado de la página
├── css/
│   └── style.css      # Estilos y temas (claro/oscuro)
├── js/
│   ├── activities.js   # Actividades personalizables (nombre, ícono, colores) + persistencia
│   ├── grid.js          # Construcción de la cuadrícula, pintado y marcador de "ahora"
│   ├── ics.js            # Exportar el horario como eventos .ics recurrentes
│   ├── notify.js          # Avisos en la app (notificación del navegador + sonido)
│   ├── google-sync.js      # Sincronización directa con un calendario dedicado en Google Calendar
│   └── app.js               # Inicialización, tema, editor de actividades y barra de herramientas
├── server.js          # Servidor estático de desarrollo (Bun) — `bun run dev`
├── package.json
└── README.md
```

## Uso

Abre `index.html` en el navegador (doble clic, o sírvelo con cualquier servidor estático).

- **Clic o arrastra** sobre la cuadrícula para pintar la actividad seleccionada.
- **Doble clic** en una celda la deja en "Libre".
- **✏️ Editar** abre el editor de actividades: nombre, ícono (emoji) opcional, color de fondo y de letra. También permite añadir o borrar actividades.
- Mientras arrastras, aparece un aviso con el rango de horas real y la duración (p. ej. "11:00 – 15:00 (4 h)"), para no confundirte contando celdas.
- La franja horaria actual queda resaltada, como en Google Calendar.
- **💾 Guardar** persiste el horario. **🧹 Limpiar** vacía todas las celdas. **↺ Recargar** restablece el horario de ejemplo inicial.

## Notificaciones para seguir el horario

Tres mecanismos, pensados para complementarse:

- **📆 Sincronizar Google** conecta con tu cuenta de Google (Google Identity Services, sin backend) y sube el horario directamente a un calendario **separado y dedicado** llamado "Mi Horario Semanal" — tu calendario principal nunca se toca. Cada sincronización borra los eventos anteriores de ese calendario y sube los actuales, con un recordatorio nativo (popup) al inicio de cada bloque. Requiere haber creado un OAuth Client ID propio en Google Cloud Console (ver más abajo) y pegarlo en `js/google-sync.js`.
- **📅 Exportar .ics** genera un archivo `mi-horario.ics` con un evento semanal recurrente por cada bloque de actividad (los tramos "Libre" no generan evento), para importar manualmente en cualquier app de calendario.
- **🔔 Avisos** activa notificaciones del navegador + un pitido cada vez que cambias de franja horaria, mientras la pestaña esté abierta. Es un plus para cuando estás trabajando frente al computador; no es confiable en el celular si el navegador queda en segundo plano o la pantalla se bloquea.

### Configurar la sincronización con Google Calendar

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto, habilita la **Google Calendar API**, configura la pantalla de consentimiento OAuth (tipo Externo, agrega tu cuenta como usuario de prueba, permiso `.../auth/calendar`) y crea un **ID de cliente de OAuth** de tipo "Aplicación web".
2. En "Orígenes autorizados de JavaScript" agrega el dominio donde sirvas la app (p. ej. `https://tbbluxari.github.io` y `http://localhost:3000` para desarrollo local).
3. Copia el Client ID resultante en la constante `GOOGLE_CLIENT_ID` de [js/google-sync.js](js/google-sync.js). No es secreto — es seguro que quede en el repo público.
4. La primera vez que uses el botón, Google mostrará una advertencia de "app no verificada" (normal para apps personales sin revisión); solo tu cuenta (agregada como test user) puede autorizarla.

## Pendiente / decisiones abiertas

- Publicación en GitHub: si el repo es privado y se activa GitHub Pages en el plan gratuito, la URL publicada queda accesible para quien la tenga (Pages gratuito no ofrece control de acceso real). Falta decidir si se sube solo como repo privado (sin Pages) o se agrega algún tipo de protección adicional.
