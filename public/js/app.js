// app.js — arranque de la app, tema, editor de actividades y orquestación
// entre backend/roles. Sustituye al init() sincrónico de la versión estática:
// ahora todo depende de sesión + datos que vienen del servidor.

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2000);
}

function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* TEMA (preferencia puramente local del dispositivo: se queda en localStorage) */
function applyTheme(t){
  document.documentElement.dataset.theme = t;
  document.getElementById('tbtn').textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('hs_theme', t);
}
function toggleTheme(){
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

/* MENÚS DESPLEGABLES (elegir actividad / ⚙️ / 🎨)
   Un solo mecanismo para los tres: togglear muestra ese panel y cierra los
   demás; un click fuera de cualquier .dropdown los cierra todos. */
function toggleDropdown(panelId){
  const panel = document.getElementById(panelId);
  const willOpen = !panel.classList.contains('show');
  document.querySelectorAll('.dropdown-panel.show').forEach(p => p.classList.remove('show'));
  if(willOpen){
    panel.classList.add('show');
    if(panelId === 'stylePanel') applyStyleOverrides();
    if(panelId === 'settingsPanel') populateGuestRulesForm();
  }
}

/* REGLAS DE INVITADO (dentro de ⚙️, solo propietario)
   Limita en qué franja horaria puede proponer un invitado y cuántas horas
   puede tener pendientes de aprobación a la vez, para que no llene el
   horario completo de una sentada. Se aplica también en el servidor (ver
   server/src/routes/proposals.routes.js) — esto es solo la UI. */
function populateGuestRulesForm(){
  const startSel = document.getElementById('ruleStart');
  const endSel = document.getElementById('ruleEnd');
  if(!startSel || !endSel) return;
  if(!startSel.options.length){
    for(let h = 0; h < 24; h++) startSel.add(new Option(String(h).padStart(2, '0') + ':00', h));
    for(let h = 1; h <= 24; h++) endSel.add(new Option(String(h).padStart(2, '0') + ':00', h));
  }
  startSel.value = guestRules.startHour;
  endSel.value = guestRules.endHour;
  document.getElementById('ruleMaxHours').value = guestRules.maxHours ?? '';
}

async function onSaveGuestRules(){
  const startHour = Number(document.getElementById('ruleStart').value);
  const endHour = Number(document.getElementById('ruleEnd').value);
  const maxRaw = document.getElementById('ruleMaxHours').value.trim();
  const maxHours = maxRaw === '' ? null : Number(maxRaw);
  if(endHour <= startHour){ toast('La hora de fin debe ser mayor que la de inicio'); return; }
  try{
    await saveGuestRules(startHour, endHour, maxHours);
  }catch(e){
    toast('❌ ' + e.message);
  }
}
document.addEventListener('click', e => {
  if(!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown-panel.show').forEach(p => p.classList.remove('show'));
});

/* SELECTOR DE ACTIVIDAD (con qué "pintar")
   Antes era una fila de píldoras que se salía de la pantalla al agregar
   muchas actividades; ahora es un botón compacto con la actividad actual que
   despliega una lista con scroll para elegir — y un atajo directo al editor
   completo para agregar/renombrar/borrar.
   El invitado no ve esta lista (puede haber actividades del propietario que
   nunca puso en el horario y prefiere mantener privadas — ver
   activities.routes.js): en su lugar crea la suya propia, ver más abajo. */
const actPickerSearch = document.getElementById('actPickerSearch');

function renderActPicker(){
  if(currentRole === 'guest') return renderGuestActList();
  const list = document.getElementById('actPickerList');
  list.innerHTML = '';
  const q = actPickerSearch.value.trim().toLowerCase();
  const filtered = q ? activities.filter(a => a.label.toLowerCase().includes(q)) : activities;
  if(filtered.length === 0){
    list.innerHTML = '<div class="act-empty">Sin resultados.</div>';
  }
  filtered.forEach(a => {
    const row = document.createElement('div');
    row.className = 'act-pick-row' + (a.id === sel ? ' on' : '');
    const sw = document.createElement('span');
    sw.className = 'act-pick-swatch';
    sw.style.background = a.bg;
    const label = document.createElement('span');
    label.textContent = (a.icon ? a.icon + ' ' : '') + a.label;
    row.append(sw, label);
    row.onclick = () => selectActivity(a.id);
    list.appendChild(row);
  });
  updateActPickerButton();
}
function selectActivity(id){
  sel = id;
  renderActPicker();
  document.getElementById('actPickerPanel').classList.remove('show');
}
function updateActPickerButton(){
  if(currentRole === 'guest' && !sel){
    document.getElementById('actPickerSwatch').style.background = 'transparent';
    document.getElementById('actPickerLabel').textContent = 'Crea una actividad';
    return;
  }
  const a = activityMap[sel] || activityMap.free;
  document.getElementById('actPickerSwatch').style.background = a.bg;
  document.getElementById('actPickerLabel').textContent = (a.icon ? a.icon + ' ' : '') + a.label;
}
actPickerSearch.addEventListener('input', () => renderActPicker());

/* ACTIVIDAD PROPIA DEL INVITADO
   guestCreatedActivities es solo de esta sesión (se pierde al salir/recargar)
   — le permite reutilizar lo que ya creó sin escribirlo de nuevo, sin
   necesitar ver la lista completa del propietario. */
let guestCreatedActivities = [];

function contrastFg(bgHex){
  const c = bgHex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#333333' : '#ffffff';
}

function renderGuestActList(){
  const list = document.getElementById('guestActList');
  if(!list) return;
  list.innerHTML = '';
  guestCreatedActivities.forEach(a => {
    const row = document.createElement('div');
    row.className = 'act-pick-row' + (a.id === sel ? ' on' : '');
    const sw = document.createElement('span');
    sw.className = 'act-pick-swatch';
    sw.style.background = a.bg;
    const label = document.createElement('span');
    label.textContent = (a.icon ? a.icon + ' ' : '') + a.label;
    row.append(sw, label);
    row.onclick = () => selectActivity(a.id);
    list.appendChild(row);
  });
  updateActPickerButton();
}

async function createGuestActivity(){
  const nameInput = document.getElementById('guestActName');
  const iconInput = document.getElementById('guestActIcon');
  const colorInput = document.getElementById('guestActColor');
  const label = nameInput.value.trim();
  if(!label){ toast('Escribe qué quieres proponer'); nameInput.focus(); return; }
  try{
    const created = await addActivity({ label, icon: iconInput.value.trim(), bg: colorInput.value, fg: contrastFg(colorInput.value) });
    guestCreatedActivities.push(created);
    selectActivity(created.id);
    nameInput.value = '';
    iconInput.value = '';
    document.getElementById('actPickerPanel').classList.remove('show');
    toast(`✓ "${label}" lista para proponer`);
  }catch(e){
    toast('❌ ' + e.message);
  }
}

/* EDITOR DE ACTIVIDADES */
const modal = document.getElementById('actModal');
const actList = document.getElementById('actList');
const actSearch = document.getElementById('actSearch');

function openActivityEditor(){
  actSearch.value = '';
  renderActList();
  modal.classList.add('show');
  setTimeout(() => actSearch.focus(), 0);
}
function closeActivityEditor(){
  modal.classList.remove('show');
  renderActPicker();
  renderAll();
}
actSearch.addEventListener('input', () => renderActList());

const persistActivity = debounce((id, patch) => {
  updateActivity(id, patch).catch(e => toast('❌ ' + e.message));
}, 400);

function renderActList(){
  actList.innerHTML = '';
  const q = actSearch.value.trim().toLowerCase();
  const filtered = q ? activities.filter(a => a.label.toLowerCase().includes(q)) : activities;
  if(filtered.length === 0){
    const empty = document.createElement('div');
    empty.className = 'act-empty';
    empty.textContent = 'No hay actividades que coincidan con la búsqueda.';
    actList.appendChild(empty);
    return;
  }
  filtered.forEach(a => {
    const row = document.createElement('div');
    row.className = 'act-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.className = 'act-name'; nameInput.value = a.label;
    nameInput.oninput = () => { a.label = nameInput.value; persistActivity(a.id, {label: nameInput.value}); };

    const iconInput = document.createElement('input');
    iconInput.type = 'text'; iconInput.className = 'act-icon'; iconInput.value = a.icon || '';
    iconInput.maxLength = 4; iconInput.placeholder = '🙂';
    iconInput.oninput = () => { a.icon = iconInput.value; persistActivity(a.id, {icon: iconInput.value}); };

    const bgInput = document.createElement('input');
    bgInput.type = 'color'; bgInput.title = 'Color de fondo'; bgInput.value = toHex(a.bg);
    bgInput.onchange = () => { a.bg = bgInput.value; persistActivity(a.id, {bg: bgInput.value}); };

    const fgInput = document.createElement('input');
    fgInput.type = 'color'; fgInput.title = 'Color de letra'; fgInput.value = toHex(a.fg);
    fgInput.onchange = () => { a.fg = fgInput.value; persistActivity(a.id, {fg: fgInput.value}); };

    row.append(nameInput, iconInput, bgInput, fgInput);

    if(a.id !== 'free'){
      const del = document.createElement('button');
      del.className = 'btn act-del'; del.textContent = '🗑';
      del.onclick = async () => {
        if(!confirm(`¿Eliminar "${a.label}"? Las celdas que la usen quedarán en "Libre".`)) return;
        await deleteActivity(a.id);
        renderActList();
      };
      row.appendChild(del);
    }
    actList.appendChild(row);
  });
}

function toHex(c){
  if(/^#[0-9a-f]{6}$/i.test(c)) return c;
  const d = document.createElement('div');
  d.style.color = c; document.body.appendChild(d);
  const rgb = getComputedStyle(d).color.match(/\d+/g);
  document.body.removeChild(d);
  if(!rgb) return '#000000';
  return '#' + rgb.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
}

document.getElementById('newActForm').addEventListener('submit', async e => {
  e.preventDefault();
  const label = document.getElementById('newActName').value.trim();
  if(!label) return;
  const icon = document.getElementById('newActIcon').value.trim();
  const bg = document.getElementById('newActBg').value;
  const fg = document.getElementById('newActFg').value;
  try{
    await addActivity({label, icon, bg, fg});
    e.target.reset();
    renderActList();
  }catch(err){
    toast('❌ ' + err.message);
  }
});

/* AJUSTE DE ALTO DE CELDAS */
function resize(){
  const hh = document.getElementById('topbar').offsetHeight;
  document.documentElement.style.setProperty('--hdr-h', hh + 'px');
  const thH = document.querySelector('thead').offsetHeight || 28;
  const avail = window.innerHeight - hh - thH;
  const ch = Math.max(20, Math.floor(avail / 24));
  document.documentElement.style.setProperty('--cell-h', ch + 'px');
  // Si el usuario fijó un tamaño de texto a mano (menú 🎨), no lo pisamos acá.
  if(!cellFontSizeManual){
    const fs = ch < 25 ? 8 : ch < 33 ? 9 : 10;
    document.documentElement.style.setProperty('--cell-font-size', fs + 'px');
  }
}

/* PERSONALIZACIÓN VISUAL (menú 🎨)
   Preferencia puramente visual y local del dispositivo (como el tema), así
   que vive en localStorage, no en el servidor: cada quien ajusta su propia
   vista sin afectar a los demás roles. El fondo de las celdas "Libre" NO
   está acá a propósito: es parte del horario compartido (se edita como
   cualquier otra actividad, en ✏️ Editar actividades), no una vista personal.
   type 'color'/'range' guardan y aplican directo el valor de su <input>;
   'select' hace lo mismo pero el <select> ya trae el valor final del CSS
   (ej. toda la lista de font-family) en cada <option value>. */
const STYLE_VARS = [
  { key: 'appFont', cssVar: '--app-font', inputId: 'styleFont', type: 'select' },
  { key: 'gridLine', cssVar: '--grid-line', inputId: 'styleGridLine', type: 'color' },
  { key: 'gridLineWidth', cssVar: '--grid-line-width', inputId: 'styleGridLineWidth', type: 'range', unit: 'px', valId: 'styleGridLineWidthVal' },
  { key: 'hourColor', cssVar: '--hour-color', inputId: 'styleHourColor', type: 'color' },
  { key: 'hourFontSize', cssVar: '--hour-font-size', inputId: 'styleHourFontSize', type: 'range', unit: 'px', valId: 'styleHourFontSizeVal' },
  { key: 'cellFontSize', cssVar: '--cell-font-size', inputId: 'styleCellFontSize', type: 'range', unit: 'px', valId: 'styleCellFontSizeVal' },
  { key: 'dayColor', cssVar: '--day-color', inputId: 'styleDayColor', type: 'color' },
  { key: 'nowMarker', cssVar: '--now-marker', inputId: 'styleNowMarker', type: 'color' },
];
const STYLE_KEY = 'hs_style_overrides';

// El tamaño del texto de las actividades normalmente lo calcula resize()
// según el alto disponible; en cuanto el usuario lo toca a mano en 🎨, deja
// de auto-ajustarse (ver resize() en app.js) hasta que le dé "Restablecer".
let cellFontSizeManual = loadStyleOverrides().cellFontSize !== undefined;

function loadStyleOverrides(){
  try{ return JSON.parse(localStorage.getItem(STYLE_KEY) || '{}'); }catch(e){ return {}; }
}
function applyStyleOverrides(){
  const saved = loadStyleOverrides();
  STYLE_VARS.forEach(v => {
    if(saved[v.key] !== undefined){
      document.documentElement.style.setProperty(v.cssVar, v.unit ? saved[v.key] + v.unit : saved[v.key]);
    }
    const input = document.getElementById(v.inputId);
    if(!input) return;
    const computed = getComputedStyle(document.documentElement).getPropertyValue(v.cssVar).trim();
    input.value = v.type === 'color' ? toHex(saved[v.key] || computed)
      : v.type === 'range' ? (saved[v.key] !== undefined ? saved[v.key] : parseFloat(computed))
      : (saved[v.key] !== undefined ? saved[v.key] : computed);
    if(v.valId) document.getElementById(v.valId).textContent = input.value + (v.unit || '');
    input.oninput = () => {
      const raw = v.type === 'range' ? Number(input.value) : input.value;
      const next = loadStyleOverrides();
      next[v.key] = raw;
      localStorage.setItem(STYLE_KEY, JSON.stringify(next));
      document.documentElement.style.setProperty(v.cssVar, v.unit ? raw + v.unit : raw);
      if(v.valId) document.getElementById(v.valId).textContent = raw + (v.unit || '');
      if(v.key === 'cellFontSize') cellFontSizeManual = true;
    };
  });
}
function resetStyleOverrides(){
  localStorage.removeItem(STYLE_KEY);
  STYLE_VARS.forEach(v => document.documentElement.style.removeProperty(v.cssVar));
  cellFontSizeManual = false;
  resize(); // vuelve a autoajustar el tamaño de las actividades según el alto disponible
  applyStyleOverrides();
  toast('↺ Estilos restablecidos');
}

/* ARRANQUE POR ROL
   Los tres roles ven la cuadrícula real (owner y booking sin restricciones;
   invitado sin la cola de propuestas — ver proposals.routes.js). Lo que
   cambia es qué datos trae cada uno además del horario/actividades, y qué
   puede hacer al tocar una celda (ver paint() en grid.js). */
async function startForRole(role){
  const tasks = [fetchActivities(), fetchSchedule()];
  if(role === 'guest') tasks.push(fetchGuestRules());
  if(role === 'booking') tasks.push(fetchBookingAvailability());
  if(role === 'owner') tasks.push(fetchProposals(), fetchGuestRules(), fetchEvents(), fetchBookingRequests());
  await Promise.all(tasks);

  if(role === 'guest'){
    sel = null; // no arranca con una actividad del propietario preseleccionada
    const nameInput = document.getElementById('guestNameInput');
    nameInput.value = guestName;
    nameInput.oninput = () => setGuestName(nameInput.value);
  }
  if(role === 'booking'){
    const nameInput = document.getElementById('bookingNameInput');
    nameInput.value = bookingName;
    nameInput.oninput = () => setBookingName(nameInput.value);
  }

  buildGrid();
  if(role !== 'booking') renderActPicker();
  initTouch();
  updateNow();
  setInterval(updateNow, 60000);

  updateNotifBtn();
  setInterval(checkActivityChange, 15000);
  setInterval(checkEventReminders, 30000);

  initGoogleAuth();

  window.addEventListener('resize', resize);
  (document.fonts?.ready || Promise.resolve()).then(resize);
  setTimeout(resize, 100);
}

// Llamado por auth.js justo después de un login exitoso desde la pantalla de
// contraseña (la primera carga, si ya había sesión, pasa por boot() directo).
async function onLoggedIn(){
  try{
    await startForRole(currentRole);
  }catch(e){
    console.error(e);
    toast('❌ No se pudo cargar tu horario: ' + e.message);
  }
}

async function boot(){
  applyTheme(localStorage.getItem('hs_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
  applyStyleOverrides();

  try{
    const me = await api('/auth/me');
    currentRole = me.role;
  }catch(e){
    currentRole = null;
  }
  applyRolePermissions();

  if(currentRole){
    try{
      await startForRole(currentRole);
    }catch(e){
      console.error(e);
      toast('❌ No se pudo cargar tu horario: ' + e.message);
    }
  }
}
document.addEventListener('DOMContentLoaded', boot);
