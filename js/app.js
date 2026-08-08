// app.js — inicialización, tema, barra de herramientas y editor de actividades.

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2000);
}

/* TEMA */
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
    nameInput.oninput = () => updateActivity(a.id, {label: nameInput.value});

    const iconInput = document.createElement('input');
    iconInput.type = 'text'; iconInput.className = 'act-icon'; iconInput.value = a.icon || '';
    iconInput.maxLength = 4; iconInput.placeholder = '🙂';
    iconInput.oninput = () => updateActivity(a.id, {icon: iconInput.value});

    const bgInput = document.createElement('input');
    bgInput.type = 'color'; bgInput.title = 'Color de fondo'; bgInput.value = toHex(a.bg);
    bgInput.oninput = () => updateActivity(a.id, {bg: bgInput.value});

    const fgInput = document.createElement('input');
    fgInput.type = 'color'; fgInput.title = 'Color de letra'; fgInput.value = toHex(a.fg);
    fgInput.oninput = () => updateActivity(a.id, {fg: fgInput.value});

    row.append(nameInput, iconInput, bgInput, fgInput);

    if(a.id !== 'free'){
      const del = document.createElement('button');
      del.className = 'btn act-del'; del.textContent = '🗑';
      del.onclick = () => {
        if(!confirm(`¿Eliminar "${a.label}"? Las celdas que la usen quedarán en "Libre".`)) return;
        deleteActivity(a.id);
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

document.getElementById('newActForm').addEventListener('submit', e => {
  e.preventDefault();
  const label = document.getElementById('newActName').value.trim();
  if(!label) return;
  const icon = document.getElementById('newActIcon').value.trim();
  const bg = document.getElementById('newActBg').value;
  const fg = document.getElementById('newActFg').value;
  addActivity({label, icon, bg, fg});
  e.target.reset();
  renderActList();
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

/* INICIO */
function init(){
  applyTheme(localStorage.getItem('hs_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
  applyRolePermissions();
  buildGrid();
  renderPalette();
  initTouch();
  updateNow();
  setInterval(updateNow, 60000);

  updateNotifBtn();
  setInterval(checkActivityChange, 15000);

  initGoogleAuth();

  window.addEventListener('resize', resize);
  (document.fonts?.ready || Promise.resolve()).then(resize);
  setTimeout(resize, 100);

  window.addEventListener('beforeunload', () => {
    try{ localStorage.setItem(DATA_KEY, JSON.stringify(data)); }catch(e){}
  });
}
document.addEventListener('DOMContentLoaded', init);
