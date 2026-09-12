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

/* PALETA */
const pal = document.getElementById('palette');
function renderPalette(){
  pal.innerHTML = '';
  activities.forEach(a => {
    const b = document.createElement('button');
    b.className = 'ab' + (a.id === sel ? ' on' : '');
    b.style.cssText = `background:${a.bg};color:${a.fg}`;
    b.textContent = (a.icon ? a.icon + ' ' : '') + a.label;
    b.dataset.id = a.id;
    b.onclick = () => {
      sel = a.id;
      document.querySelectorAll('.ab').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    };
    pal.appendChild(b);
  });
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
  renderPalette();
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
  const fs = ch < 25 ? 8 : ch < 33 ? 9 : 10;
  document.querySelectorAll('td.sc').forEach(td => { td.style.fontSize = fs + 'px'; });
}

/* ARRANQUE POR ROL
   El rol "booking" nunca ve el horario (privacidad: solo ve huecos libres,
   no qué actividad hay en cada uno). Owner/guest sí necesitan el horario, las
   actividades y las propuestas cargadas antes de construir la cuadrícula. */
async function startForRole(role){
  if(role === 'booking'){
    await initBookingView();
    return;
  }

  const tasks = [fetchActivities(), fetchSchedule(), fetchProposals()];
  if(role === 'owner') tasks.push(fetchEvents(), fetchBookingRequests());
  await Promise.all(tasks);

  buildGrid();
  renderPalette();
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
