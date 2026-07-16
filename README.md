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
│   └── app.js               # Inicialización, tema, editor de actividades y barra de herramientas
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

Dos mecanismos, pensados para complementarse:

- **📅 Exportar** genera un archivo `mi-horario.ics` con un evento semanal recurrente por cada bloque de actividad (los tramos "Libre" no generan evento). Impórtalo una vez en Google Calendar / Apple Calendar y usa sus recordatorios nativos — esta es la vía confiable: funciona en celular, web y escritorio, incluso con la app cerrada. Si luego editas el horario, hay que volver a exportar y reimportar para actualizarlo.
- **🔔 Avisos** activa notificaciones del navegador + un pitido cada vez que cambias de franja horaria, mientras la pestaña esté abierta. Es un plus para cuando estás trabajando frente al computador; no es confiable en el celular si el navegador queda en segundo plano o la pantalla se bloquea.

## Pendiente / decisiones abiertas

- Publicación en GitHub: si el repo es privado y se activa GitHub Pages en el plan gratuito, la URL publicada queda accesible para quien la tenga (Pages gratuito no ofrece control de acceso real). Falta decidir si se sube solo como repo privado (sin Pages) o se agrega algún tipo de protección adicional.
