# Mi Horario Semanal

Horario semanal interactivo (24 h × 7 días) que corre completamente en el navegador, sin backend. Los datos se guardan en `localStorage`.

## Estructura

```
Calendario/
├── index.html        # Marcado de la página
├── css/
│   └── style.css      # Estilos y temas (claro/oscuro)
├── js/
│   ├── auth.js            # Candado de acceso: contraseña de propietario/invitado y permisos por rol
│   ├── activities.js   # Actividades personalizables (nombre, ícono, colores) + persistencia
│   ├── grid.js          # Construcción de la cuadrícula, pintado, marcador de "ahora" y propuestas de invitados
│   ├── ics.js            # Exportar el horario como eventos .ics recurrentes
│   ├── notify.js          # Avisos en la app (notificación del navegador + sonido + alerta bloqueante)
│   ├── google-sync.js      # Sincronización (subir/traer) con un calendario dedicado en Google Calendar
│   └── app.js               # Inicialización, tema, editor de actividades y barra de herramientas
├── server.js          # Servidor estático de desarrollo (Bun) — `bun run dev`
├── package.json
└── README.md
```

## Uso

Abre `index.html` en el navegador (doble clic, o sírvelo con cualquier servidor estático).

- **Clic o arrastra** sobre la cuadrícula para pintar la actividad seleccionada.
- **Doble clic** en una celda la deja en "Libre".
- **✏️ Editar** abre el editor de actividades: nombre, ícono (emoji) opcional, color de fondo y de letra. También permite añadir, borrar o **buscar** actividades (útil cuando la lista crece).
- Mientras arrastras, aparece un aviso con el rango de horas real y la duración (p. ej. "11:00 – 15:00 (4 h)"), para no confundirte contando celdas.
- La franja horaria actual queda resaltada, como en Google Calendar.
- **💾 Guardar** persiste el horario. **🧹 Limpiar** vacía todas las celdas. **↺ Recargar** restablece el horario de ejemplo inicial.

## Notificaciones para seguir el horario

Tres mecanismos, pensados para complementarse:

- **📆 Sincronizar Google** conecta con tu cuenta de Google (Google Identity Services, sin backend) y sube el horario directamente a un calendario **separado y dedicado** llamado "Mi Horario Semanal" — tu calendario principal nunca se toca. Cada sincronización borra los eventos anteriores de ese calendario y sube los actuales, con un recordatorio nativo (popup) al inicio de cada bloque. Requiere haber creado un OAuth Client ID propio en Google Cloud Console (ver más abajo) y pegarlo en `js/google-sync.js`.
- **🔄 Traer de Google** es la contraparte de sincronizar: reconstruye el horario y las actividades **locales** a partir de lo que ya esté guardado en el calendario dedicado. Así puedes coordinar varios computadores: sincronizas desde uno (sube) y traes desde el otro (baja), en vez de que cada uno sobreescriba con su propia versión. Cada evento guarda el bloque y la actividad completa (id, color, ícono) en una propiedad privada, invisible en la UI de Google Calendar, para poder reconstruir el horario exacto.
- **📅 Exportar .ics** genera un archivo `mi-horario.ics` con un evento semanal recurrente por cada bloque de actividad (los tramos "Libre" no generan evento), para importar manualmente en cualquier app de calendario.
- **🔔 Avisos** activa notificaciones del navegador + un pitido fuerte (tres tonos) cada vez que cambias de franja horaria, mientras la pestaña esté abierta, junto con una alerta de pantalla completa que no se puede cerrar hasta que le des "Aceptar" (el pitido se repite y el título de la pestaña parpadea mientras tanto). Es un plus para cuando estás trabajando frente al computador; no es confiable en el celular si el navegador queda en segundo plano o la pantalla se bloquea, y ningún navegador puede "bloquear" el sistema fuera de la propia pestaña.

## Candado de acceso: propietario e invitados

Por defecto la app **no pide contraseña** (queda igual que antes). Para activarlo:

1. Abre la app en el navegador, abre la consola de desarrollador (F12) y ejecuta, para cada contraseña que quieras usar:
   ```js
   await hashPassword('tu-contraseña')
   ```
2. Copia el resultado (un hash SHA-256) en `OWNER_HASH` y `GUEST_HASH` dentro de [js/auth.js](js/auth.js).
3. Recarga la página: ahora pedirá contraseña antes de mostrar el horario.

**Importante:** al ser un sitio 100% estático (sin servidor), esto es un candado *ligero* que filtra visitas casuales — no seguridad real, porque el hash queda visible en el código fuente público y alguien con conocimientos técnicos podría intentar romperlo por fuerza bruta. No lo uses para proteger información sensible.

Con la contraseña de **propietario** tienes acceso completo, igual que ahora. Con la de **invitado**:
- Solo puede pintar actividades sobre celdas que estén en "Libre" (no puede editar ni borrar lo que ya pusiste) — queda como una **propuesta** (borde punteado), no se guarda en el horario real todavía.
- No ve el editor de actividades, ni los botones de sincronizar/traer de Google, Guardar, Limpiar o Recargar.
- Tiene un botón **📋 Copiar propuestas** para copiar un resumen de texto y enviártelo (WhatsApp, mensaje, etc.) — no hay backend que te avise automáticamente si el invitado usa un computador distinto al tuyo.

Tú, como propietario, ves el botón **📩 Propuestas (N)** con la cantidad de propuestas pendientes; ábrelo para aprobar (se aplican al horario real) o rechazar cada una.

### Configurar la sincronización con Google Calendar

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto, habilita la **Google Calendar API**, configura la pantalla de consentimiento OAuth (tipo Externo, agrega tu cuenta como usuario de prueba, permiso `.../auth/calendar`) y crea un **ID de cliente de OAuth** de tipo "Aplicación web".
2. En "Orígenes autorizados de JavaScript" agrega el dominio donde sirvas la app (p. ej. `https://tbbluxari.github.io` y `http://localhost:3000` para desarrollo local).
3. Copia el Client ID resultante en la constante `GOOGLE_CLIENT_ID` de [js/google-sync.js](js/google-sync.js). No es secreto — es seguro que quede en el repo público.
4. La primera vez que uses el botón, Google mostrará una advertencia de "app no verificada" (normal para apps personales sin revisión); solo tu cuenta (agregada como test user) puede autorizarla.

## Pendiente / decisiones abiertas

- Publicación en GitHub: si el repo es privado y se activa GitHub Pages en el plan gratuito, la URL publicada queda accesible para quien la tenga (Pages gratuito no ofrece control de acceso real). Se agregó un candado ligero (ver arriba) que filtra visitas casuales, pero **no** es control de acceso real — si necesitas eso, la alternativa es un backend con autenticación propia.
