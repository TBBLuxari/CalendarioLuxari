// grid.js — construcción de la cuadrícula, pintado de celdas y marcador de "ahora".

const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

const A = (n, t) => Array(n).fill(t);
const DEFAULT_SCHEDULE = [
  [...A(8,'sleep'),'free','free','plan','plan','commute','commute',...A(7,'work'),'commute','meal','winddown'],
  [...A(4,'sleep'),'free','commute','commute',...A(8,'work'),'commute','commute','personal','plan','personal','personal','sleep','sleep','sleep'],
  [...A(8,'sleep'),'free','commute',...A(11,'work'),'commute','gym','winddown'],
  [...A(9,'sleep'),...A(3,'personal'),'prep','prep',...A(8,'personal'),'gym','winddown'],
  [...A(8,'sleep'),'free','free','plan','plan','commute','commute',...A(7,'work'),'commute','gym','winddown'],
  [...A(9,'sleep'),'personal','personal','prep','prep',...A(10,'personal'),'winddown'],
  [...A(9,'sleep'),'personal','personal','prep','prep','prep',...A(4,'personal'),'plan','plan','personal','winddown','winddown','sleep'],
];

const DATA_KEY = 'hs_data';

function loadData(){
  try{ const s = localStorage.getItem(DATA_KEY); if(s) return JSON.parse(s); }catch(e){}
  return DEFAULT_SCHEDULE.map(d => [...d]);
}

let data = loadData();
let sel = 'sleep';
let drag = false;
let dragStart = null;

const tbody = document.getElementById('sbody');
const hrow = document.getElementById('hrow');
const cells = Array.from({length:7}, () => []);
const timeCells = [];

function buildGrid(){
  hrow.innerHTML = '';
  const corner = document.createElement('th'); corner.className = 'corner'; hrow.appendChild(corner);
  days.forEach((d, i) => {
    const th = document.createElement('th');
    th.textContent = d;
    th.dataset.day = i;
    hrow.appendChild(th);
  });

  tbody.innerHTML = '';
  for(let d = 0; d < 7; d++) cells[d].length = 0;
  timeCells.length = 0;

  for(let h = 0; h < 24; h++){
    const tr = tbody.insertRow();

    const tc = tr.insertCell();
    tc.className = 'tc' + (h % 6 === 0 ? ' h6' : '');
    tc.dataset.h = h;
    const span = document.createElement('span');
    span.className = 'tlabel';
    span.textContent = h.toString().padStart(2, '0') + ':00';
    tc.appendChild(span);
    timeCells.push(tc);

    for(let d = 0; d < 7; d++){
      const td = tr.insertCell();
      td.className = 'sc' + (h % 6 === 0 ? ' h6' : '');
      td.dataset.d = d; td.dataset.h = h;
      cells[d].push(td);
      applyCell(td, data[d][h]);

      td.addEventListener('mousedown', e => {
        drag = true; dragStart = {d, h};
        paint(d, h); showDragTip(d, h, h);
        e.preventDefault();
      });
      td.addEventListener('mouseenter', () => { if(drag) paintRange(d, h); });
      td.addEventListener('dblclick', () => { data[d][h] = 'free'; applyCell(td, 'free'); });
    }
  }
  document.addEventListener('mouseup', endDrag);
}

function paint(d, h){
  data[d][h] = sel;
  applyCell(cells[d][h], sel);
}

function paintRange(d, h){
  if(!dragStart || dragStart.d !== d) dragStart = {d, h};
  paint(d, h);
  const from = Math.min(dragStart.h, h), to = Math.max(dragStart.h, h);
  showDragTip(d, from, to);
}

function endDrag(){
  drag = false; dragStart = null; hideDragTip();
}

function applyCell(td, id){
  const a = activityMap[id] || activityMap.free;
  td.style.background = a.bg;
  td.style.color = a.fg;
  td.textContent = a.icon ? (a.icon + ' ' + a.label) : (id === 'free' ? '' : a.label);
}

function renderAll(){
  for(let d = 0; d < 7; d++) for(let h = 0; h < 24; h++) applyCell(cells[d][h], data[d][h]);
}

function resetAll(){
  if(!confirm('¿Restablecer al horario inicial?')) return;
  data = DEFAULT_SCHEDULE.map(d => [...d]);
  renderAll();
  toast('Restablecido');
}

function clearAll(){
  if(!confirm('¿Vaciar todo el horario? Todas las celdas quedarán en "Libre".')) return;
  data = Array.from({length:7}, () => A(24, 'free'));
  renderAll();
  toast('Horario vaciado');
}

function saveData(){
  try{ localStorage.setItem(DATA_KEY, JSON.stringify(data)); }catch(e){}
  toast('✓ Guardado');
}

/* TOUCH */
let lastTouchTd = null;
function initTouch(){
  const gw = document.getElementById('grid');
  gw.addEventListener('touchstart', e => {
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    if(el?.classList.contains('sc')){
      const d = +el.dataset.d, h = +el.dataset.h;
      drag = true; dragStart = {d, h};
      paint(d, h); showDragTip(d, h, h);
      lastTouchTd = el; e.preventDefault();
    }
  }, {passive:false});
  gw.addEventListener('touchmove', e => {
    if(!drag) return;
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    if(el?.classList.contains('sc') && el !== lastTouchTd){
      paintRange(+el.dataset.d, +el.dataset.h);
      lastTouchTd = el;
    }
    e.preventDefault();
  }, {passive:false});
  document.addEventListener('touchend', () => { endDrag(); lastTouchTd = null; });
}

/* AVISO DE ARRASTRE
   Muestra el rango de horas real y la duración mientras se pinta, para que
   sea evidente que, p. ej., pintar las celdas 11-12-13-14 da 11:00–15:00
   (4 h) y no 11:00–14:00 como sugiere contar solo las etiquetas tocadas. */
const dragTip = document.getElementById('dragTip');
function showDragTip(d, fromH, toH){
  const start = fromH.toString().padStart(2, '0') + ':00';
  const end = ((toH + 1) % 24).toString().padStart(2, '0') + ':00';
  const hours = toH - fromH + 1;
  dragTip.textContent = `${days[d]} · ${start} – ${end} (${hours} h)`;
  dragTip.classList.add('show');
}
function hideDragTip(){ dragTip.classList.remove('show'); }

/* MARCADOR DE "AHORA" */
function updateNow(){
  document.querySelectorAll('.now-col').forEach(el => el.classList.remove('now-col'));
  document.querySelectorAll('.now-row').forEach(el => el.classList.remove('now-row'));
  document.querySelectorAll('.now-cell').forEach(el => {
    el.classList.remove('now-cell');
    const l = el.querySelector('.now-line');
    if(l) l.remove();
  });

  const now = new Date();
  const d = (now.getDay() + 6) % 7; // getDay(): 0=domingo → nuestro índice: 0=lunes
  const h = now.getHours();
  const m = now.getMinutes();

  const th = hrow.children[d + 1];
  if(th) th.classList.add('now-col');

  const tc = timeCells[h];
  if(tc) tc.classList.add('now-row');

  const td = cells[d]?.[h];
  if(td){
    td.classList.add('now-cell');
    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = (m / 60 * 100) + '%';
    td.appendChild(line);
  }
}
