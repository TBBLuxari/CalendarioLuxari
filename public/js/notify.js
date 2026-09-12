// notify.js — avisos dentro de la app (notificación del navegador + pitido)
// mientras la pestaña esté abierta. Complementa la exportación a calendario
// (js/ics.js), que es la vía confiable cuando la app NO está abierta.

let notifsEnabled = localStorage.getItem('hs_notifs') === '1';
let lastSlotKey = null;
let audioCtx = null;

/* Pitido fuerte y pronunciado: 3 tonos ascendentes en vez de un solo beep
   suave, con más ganancia, para que sea difícil no notarlo. */
function beep(){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const freqs = [740, 880, 1046];
    freqs.forEach((freq, i) => {
      const start = audioCtx.currentTime + i * 0.16;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }catch(e){}
}

/* ALERTA BLOQUEANTE
   Muestra un modal de pantalla completa que solo se cierra con el botón
   "Aceptar", repitiendo el pitido y parpadeando el título de la pestaña
   mientras tanto. Solo funciona con la pestaña abierta — un navegador no
   puede tomar control del sistema fuera de eso. */
const alertModal = document.getElementById('alertModal');
const alertBody = document.getElementById('alertBody');
const alertAcceptBtn = document.getElementById('alertAcceptBtn');
const ORIG_TITLE = document.title;
let alertRepeatTimer = null;
let titleFlashTimer = null;

function showBlockingAlert(label){
  alertBody.textContent = label;
  alertModal.classList.add('show');
  beep();
  clearInterval(alertRepeatTimer);
  alertRepeatTimer = setInterval(beep, 2200);
  clearInterval(titleFlashTimer);
  let on = false;
  titleFlashTimer = setInterval(() => {
    document.title = (on = !on) ? '⏰ ¡Cambio de actividad!' : ORIG_TITLE;
  }, 1000);
  window.focus();
  setTimeout(() => alertAcceptBtn.focus(), 0);
}

function acknowledgeActivityAlert(){
  alertModal.classList.remove('show');
  clearInterval(alertRepeatTimer);
  clearInterval(titleFlashTimer);
  document.title = ORIG_TITLE;
}

function updateNotifBtn(){
  const b = document.getElementById('notifBtn');
  if(!b) return;
  b.textContent = notifsEnabled ? '🔔 Avisos: ON' : '🔕 Avisos';
  b.classList.toggle('on', notifsEnabled);
}

function toggleNotifs(){
  if(notifsEnabled){
    notifsEnabled = false;
    localStorage.setItem('hs_notifs', '0');
    updateNotifBtn();
    toast('Avisos desactivados');
    return;
  }
  if(!('Notification' in window)){
    toast('Tu navegador no soporta notificaciones');
    return;
  }
  Notification.requestPermission().then(perm => {
    if(perm !== 'granted'){ toast('Permiso de notificaciones denegado'); return; }
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    notifsEnabled = true;
    lastSlotKey = currentSlotKey(); // evita avisar de inmediato a mitad de un bloque
    localStorage.setItem('hs_notifs', '1');
    updateNotifBtn();
    toast('Avisos activados');
  });
}

function currentSlotKey(){
  const now = new Date();
  const d = (now.getDay() + 6) % 7;
  const h = now.getHours();
  return d + '_' + h;
}

function checkActivityChange(){
  if(!notifsEnabled) return;
  const key = currentSlotKey();
  if(key === lastSlotKey) return;
  lastSlotKey = key;

  const [d, h] = key.split('_').map(Number);
  const id = data[d]?.[h];
  if(id === undefined) return;
  const a = activityMap[id] || activityMap.free;
  const label = (a.icon ? a.icon + ' ' : '') + a.label;

  if(Notification.permission === 'granted'){
    new Notification('Cambio de actividad', {body: label, tag: 'hs-activity'});
  }
  showBlockingAlert(label);
}

/* RECORDATORIO DE EVENTOS CON FECHA (plazos, entregas, citas)
   Complementa checkActivityChange: dispara la misma alerta bloqueante en
   cuanto arranca la hora de un evento marcado con "Recordarme", mientras la
   pestaña esté abierta. La sincronización con Google (google-sync.js/ics.js)
   es la vía confiable para cuando la app está cerrada. */
const FIRED_EVENTS_KEY = 'hs_fired_events';
let firedEventIds = new Set();
try{ firedEventIds = new Set(JSON.parse(localStorage.getItem(FIRED_EVENTS_KEY) || '[]')); }catch(e){}

function checkEventReminders(){
  if(!notifsEnabled || typeof events === 'undefined' || currentRole !== 'owner') return;
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  events.forEach(ev => {
    if(!ev.remind || ev.date !== dateStr || firedEventIds.has(ev.id)) return;
    const evTime = new Date(now); evTime.setHours(ev.startHour, 0, 0, 0);
    const diffMs = now - evTime;
    if(diffMs < 0 || diffMs > 5 * 60 * 1000) return; // ventana de 5 min tras el inicio

    firedEventIds.add(ev.id);
    try{ localStorage.setItem(FIRED_EVENTS_KEY, JSON.stringify([...firedEventIds])); }catch(e){}

    const label = '📌 ' + ev.title;
    if(Notification.permission === 'granted'){
      new Notification('Evento', {body: ev.title, tag: 'hs-event-' + ev.id});
    }
    showBlockingAlert(label);
  });
}
